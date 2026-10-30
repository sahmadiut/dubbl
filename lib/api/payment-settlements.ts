import { createHash } from "node:crypto";
import { z } from "zod";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { organization, invoice, bill, billLine, contact, bankAccount, chartAccount, payment, paymentAllocation,
  journalEntry, journalLine, numberSequence, auditLog, creditNote, debitNote, customerCredit } from "@/lib/db/schema";
import { AuthError, type AuthContext } from "./auth-context";
import { requireRole } from "./require-role";
import { assertNotLocked } from "./period-lock";
import { currencyCodeSchema } from "@/lib/currency/zod";
import { rateDateSchema } from "@/lib/currency/rate-policy";
import { createHistoricalRateResolver } from "@/lib/currency/historical-rate";
import { toLegacyRate } from "@/lib/currency/exact-rate";
import { MissingExchangeRateError } from "@/lib/currency/converter";
import { WireCompatibilityError, stringifyWire } from "@/lib/money/wire";
import { lifecycleDto } from "./invoice-lifecycle-wire";
import { billWriteDto } from "./bill-write-wire";
import { safeInvoiceMinor, invoiceRound } from "./invoice-write-wire";
import { creditAmount } from "./credit-wire";
import { publicMoneyDto, publicLineDto } from "./public-money-wire";
import { paymentReadDto } from "./payment-read-wire";
import { journalLineDto } from "./journal-wire";
import { assertJournalReferences } from "./journal-references";
import { receivableAccount } from "./invoice-lifecycle";
import { ensureBankLedgerAccount } from "./bank-ledger";
import { paymentCreateSchema, paymentPaySchema, paymentAllocations, paymentCashBase, paymentCarryingBase } from "./payment-settlement-wire";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Document = typeof invoice.$inferSelect | typeof bill.$inferSelect;
type Allocation = { documentId: string; documentType: "invoice" | "bill"; amount: number };
type Pay = z.infer<typeof paymentPaySchema>;
function fail(message: string): never { throw new AuthError(message, 400); }
function unsupported(message: string): never { throw new WireCompatibilityError(message); }
const memo = (id: string) => `Settlement document ${id}`;

async function ownedAccount(tx: Tx, ctx: AuthContext, id: string, active = false, locking = true) {
  const query = tx.select().from(chartAccount).where(and(eq(chartAccount.id, id), eq(chartAccount.organizationId, ctx.organizationId)));
  const [row] = await (locking ? query.for("share") : query);
  if (!row || (active && (!row.isActive || row.deletedAt))) unsupported("Settlement account is unavailable in this organization");
  return row;
}
async function savedJournal(tx: Tx, ctx: AuthContext, id: string | null, source: string, documentId: string, currency: string, reference: string, locking = true) {
  const query = tx.select().from(journalEntry).where(and(eq(journalEntry.id, id ?? "00000000-0000-0000-0000-000000000000"), eq(journalEntry.organizationId, ctx.organizationId)));
  const [entry] = id ? await (locking ? query.for("update") : query) : [];
  if (!entry || entry.deletedAt || entry.status !== "posted" || entry.reversedByEntryId || entry.sourceType !== source ||
    (entry.sourceId !== null ? entry.sourceId !== documentId : entry.reference !== reference)) unsupported("Settlement requires qualified unreversed recognition history");
  const lines = await tx.select().from(journalLine).where(eq(journalLine.journalEntryId, entry.id)).limit(locking ? 2147483647 : 101);
  if (!locking && lines.length > 100) unsupported("Preview recognition history is oversized");
  const first = lines[0]; let debit = 0n, credit = 0n;
  if (!first?.rateExact) unsupported("Recognition history has no saved exact FX");
  for (const line of lines) {
    journalLineDto(line); await ownedAccount(tx, ctx, line.accountId, false, locking);
    if (line.currencyCode !== currency || line.rateExact !== first.rateExact || line.rateMigrationStatus !== "exact" ||
      line.rateFormatVersion !== 1 || line.debitAmount < 0 || line.creditAmount < 0 || (line.debitAmount && line.creditAmount))
      unsupported("Recognition history has inconsistent saved FX or amounts");
    debit += BigInt(line.debitAmount); credit += BigInt(line.creditAmount);
  }
  safeInvoiceMinor(debit); safeInvoiceMinor(credit);
  if (debit !== credit || debit <= 0n) unsupported("Recognition history must balance");
  return { entry, lines, rateExact: first.rateExact! };
}
async function loadDocument(tx: Tx, ctx: AuthContext, alloc: Allocation, locking = true) {
  const table = alloc.documentType === "invoice" ? invoice : bill;
  const query = tx.select().from(table).where(and(eq(table.id, alloc.documentId), eq(table.organizationId, ctx.organizationId), isNull(table.deletedAt)));
  const [row] = await (locking ? query.for("update") : query);
  if (!row) throw new AuthError(`${alloc.documentType} not found`, 404);
  lifecycleDto(row); currencyCodeSchema.parse(row.currencyCode); rateDateSchema.parse(row.issueDate);
  const statuses = alloc.documentType === "invoice" ? ["sent", "partial", "overdue"] : ["received", "partial", "overdue"];
  if (!statuses.includes(row.status) || !row.journalEntryId || row.amountPaid < 0 || row.amountDue <= 0) fail("Only recognized outstanding documents can be settled");
  if (alloc.amount > row.amountDue) fail("Payment exceeds the outstanding document balance");
  return row;
}
async function recognition(tx: Tx, ctx: AuthContext, row: Document, kind: "invoice" | "bill", locking = true) {
  const reference = "invoiceNumber" in row ? row.invoiceNumber : row.billNumber;
  if (kind === "invoice") return savedJournal(tx, ctx, row.journalEntryId, "invoice", row.id, row.currencyCode, reference, locking);
  // GRNI-matched bills can recognize AP partly/entirely in a separate clearing
  // journal. Both saved entries form the payable; tax-only main AP is not enough.
  const query = tx.select().from(journalEntry).where(and(eq(journalEntry.organizationId, ctx.organizationId),
    sql`(${journalEntry.id} = ${row.journalEntryId} or (${journalEntry.sourceId} = ${row.id} and ${journalEntry.sourceType} in ('bill','bill_grni')))`));
  const entries = await (locking ? query.for("update") : query);
  const primary = entries.find(entry => entry.id === row.journalEntryId);
  if (!primary || !["bill", "bill_grni"].includes(primary.sourceType ?? "") || entries.length > 2 || new Set(entries.map(e => e.sourceType)).size !== entries.length)
    unsupported("Bill recognition/GRNI history is missing or ambiguous");
  const snapshots: Awaited<ReturnType<typeof savedJournal>>[] = [];
  for (const entry of entries) {
    const saved = await savedJournal(tx, ctx, entry.id, entry.sourceType!, row.id, row.currencyCode, reference, locking);
    if (entry.date !== row.issueDate) unsupported("Bill recognition posting date differs from its issue date"); snapshots.push(saved);
  }
  if (snapshots.some(saved => saved.rateExact !== snapshots[0].rateExact)) unsupported("Bill and GRNI recognition FX disagree");
  return { entry: primary, lines: snapshots.flatMap(saved => saved.lines), rateExact: snapshots[0].rateExact };
}
async function previousCarrying(tx: Tx, ctx: AuthContext, row: Document, alloc: Allocation, controlId: string,
  original: number, payable: number, base: string, recognitionRate: string, locking = true) {
  const historyQuery = tx.select({ allocation: paymentAllocation, payment }).from(paymentAllocation)
    .innerJoin(payment, eq(payment.id, paymentAllocation.paymentId))
    .where(and(eq(paymentAllocation.documentId, row.id), eq(paymentAllocation.documentType, alloc.documentType), isNull(payment.deletedAt)))
    .orderBy(payment.id).limit(locking ? 2147483647 : 101);
  const history = await (locking ? historyQuery.for("update") : historyQuery);
  if (!locking && history.length > 100) unsupported("Preview settlement history is oversized");
  let paid = 0n, carrying = 0n;
  const observations: unknown[] = [history];
  for (const h of history) {
    const p = h.payment; publicMoneyDto(p, ["amount"]); publicMoneyDto(h.allocation, ["amount"]);
    if (p.organizationId !== ctx.organizationId || p.contactId !== row.contactId || p.currencyCode !== row.currencyCode ||
      p.type !== (alloc.documentType === "invoice" ? "received" : "made") || h.allocation.amount <= 0) unsupported("Saved settlement allocation is inconsistent or foreign");
    paid += BigInt(h.allocation.amount);
    const pairs = await tx.select().from(paymentAllocation).where(eq(paymentAllocation.paymentId, p.id)).limit(locking ? 2147483647 : 101);
    if (!locking && pairs.length > 100) unsupported("Preview allocation history is oversized");
    observations.push(pairs);
    const prepaid = pairs.find(a => a.documentType === "prepayment");
    if (prepaid) {
      if (alloc.documentType !== "invoice" || pairs.length !== 2 || prepaid.amount !== h.allocation.amount || p.amount !== h.allocation.amount)
        unsupported("Unqualified prepayment carrier allocations");
      const query = tx.select().from(customerCredit).where(and(eq(customerCredit.id, prepaid.documentId), eq(customerCredit.organizationId, ctx.organizationId)));
      const [credit] = await (locking ? query.for("share") : query);
      if (!credit || credit.deletedAt || !["open", "applied"].includes(credit.status) || credit.contactId !== row.contactId || credit.currencyCode !== row.currencyCode)
        unsupported("Prepayment carrier belongs to unavailable or foreign credit");
      publicMoneyDto(credit, ["originalAmount", "amountRemaining"]);
      const saved = await savedJournal(tx, ctx, p.journalEntryId, "customer_credit_application", credit.id, row.currencyCode,
        "invoiceNumber" in row ? row.invoiceNumber : "", locking);
      observations.push(credit, saved);
      const value = saved.lines.filter(line => line.accountId === controlId).reduce((sum, line) => sum + BigInt(line.creditAmount) - BigInt(line.debitAmount), 0n);
      if (value <= 0n || saved.rateExact !== recognitionRate || value * BigInt(payable) !== BigInt(original) * BigInt(h.allocation.amount))
        unsupported("Prepayment carrying FX/rounding requires separate qualification");
      carrying += value;
    } else if (p.journalEntryId) {
      const saved = await savedJournal(tx, ctx, p.journalEntryId, "payment", p.id, row.currencyCode, p.paymentNumber, locking);
      const [audit] = await tx.select({ changes: auditLog.changes }).from(auditLog).where(and(eq(auditLog.organizationId, ctx.organizationId),
        eq(auditLog.entityType, "payment"), eq(auditLog.entityId, p.id), eq(auditLog.action, "settle")));
      if ((audit?.changes as { baseCurrencyCode?: string } | null)?.baseCurrencyCode !== base) unsupported("Saved cash settlement lacks qualified base-currency provenance");
      observations.push(saved, audit);
      const matching = saved.lines.filter(line => line.accountId === controlId && line.description === memo(row.id));
      if (matching.length !== 1) unsupported("Historical cash settlement needs a document-specific carrying leg");
      const line = matching[0];
      const value = alloc.documentType === "invoice" ? BigInt(line.creditAmount) - BigInt(line.debitAmount) : BigInt(line.debitAmount) - BigInt(line.creditAmount);
      if (value < 0n) unsupported("Historical cash control leg has the wrong direction"); carrying += value;
    } else {
      // Credit/debit carriers relieve no new cash. Only existing matching-FX,
      // exactly proportional note applications are qualified in this slice.
      const kind = alloc.documentType === "invoice" ? "credit_note" : "debit_note";
      const noteAlloc = pairs.find(a => a.documentType === kind);
      if (pairs.length !== 2 || !noteAlloc || noteAlloc.amount !== h.allocation.amount || p.amount !== h.allocation.amount)
        unsupported("Unqualified noncash/prepayment carrier history");
      const table = kind === "credit_note" ? creditNote : debitNote;
      const query = tx.select().from(table).where(and(eq(table.id, noteAlloc.documentId), eq(table.organizationId, ctx.organizationId)));
      const [note] = await (locking ? query.for("share") : query);
      if (!note || note.deletedAt || !["sent", "applied"].includes(note.status) || note.contactId !== row.contactId || note.currencyCode !== row.currencyCode || note.total <= 0)
        unsupported("Noncash note history is unavailable or foreign");
      const saved = await savedJournal(tx, ctx, note.journalEntryId, kind, note.id, row.currencyCode,
        "creditNoteNumber" in note ? note.creditNoteNumber : note.debitNoteNumber, locking);
      observations.push(note, saved);
      const credit = saved.lines.filter(line => line.accountId === controlId).reduce((s, line) => s + (kind === "credit_note"
        ? BigInt(line.creditAmount) - BigInt(line.debitAmount) : BigInt(line.debitAmount) - BigInt(line.creditAmount)), 0n);
      if (saved.rateExact !== recognitionRate || credit * BigInt(payable) !== BigInt(original) * BigInt(note.total)
        || BigInt(original) * BigInt(h.allocation.amount) % BigInt(payable) !== 0n) unsupported("Noncash carrying FX/rounding requires separate qualification");
      carrying += BigInt(original) * BigInt(h.allocation.amount) / BigInt(payable);
    }
  }
  if (paid !== BigInt(row.amountPaid) || carrying !== invoiceRound(BigInt(original) * paid, BigInt(payable)))
    unsupported("Document paid balance and saved settlement carrying history disagree");
  return observations;
}

/** Internal period-end consumer: qualify the saved base GL and its cumulative releases.
 * GL legs already contain base minor units; never convert them a second time.
 */
export async function revaluationExposure(tx: Tx, ctx: AuthContext, row: Document, kind: "invoice" | "bill", base: string, asOfDate: string) {
  lifecycleDto(row); currencyCodeSchema.parse(row.currencyCode); rateDateSchema.parse(row.issueDate);
  const statuses = kind === "invoice" ? ["sent", "partial", "overdue", "paid"] : ["received", "partial", "overdue", "paid"];
  if (row.organizationId !== ctx.organizationId || row.deletedAt || !statuses.includes(row.status) || row.amountPaid < 0 || row.amountDue < 0)
    unsupported("Revaluation requires recognized nonnegative outstanding documents");
  // Current balances cannot stand in for an earlier period after a later release.
  // Include paid documents in this guard, so a later full settlement cannot disappear.
  const later = await tx.select({ id: payment.id }).from(paymentAllocation).innerJoin(payment, eq(payment.id, paymentAllocation.paymentId))
    .where(and(eq(paymentAllocation.documentId, row.id), eq(paymentAllocation.documentType, kind), isNull(payment.deletedAt), sql`${payment.date} > ${asOfDate}`)).limit(1);
  if (later.length) unsupported("Revaluation cannot reconstruct balances after a later settlement");
  if (row.amountDue === 0) return null;
  const [party] = await tx.select().from(contact).where(and(eq(contact.id, row.contactId), eq(contact.organizationId, ctx.organizationId))).for("share");
  if (!party || party.deletedAt) unsupported("Revaluation contact is unavailable in this organization");
  const control = await receivableAccount(tx, ctx.organizationId, kind === "invoice" ? "1200" : "2100");
  if (control.currencyCode !== base || control.type !== (kind === "invoice" ? "asset" : "liability")) unsupported("Unqualified revaluation control account");
  const snapshot = "senderSnapshot" in row ? row.senderSnapshot as { baseCurrencyCode?: string } | null : null;
  if (snapshot?.baseCurrencyCode && snapshot.baseCurrencyCode !== base) unsupported("Base currency changed after recognition");
  const saved = await recognition(tx, ctx, row, kind);
  if (saved.entry.date !== row.issueDate) unsupported("Recognition date disagrees with document issue date");
  await assertJournalReferences(ctx.organizationId, saved.lines, saved.entry.fiscalYearId, true, tx);
  if (saved.lines.some(line => line.rateProvenance !== "legacy_scaled_1e6:transaction")) unsupported("Recognition FX provenance is unqualified");
  const original = safeInvoiceMinor(saved.lines.filter(line => line.accountId === control.id).reduce((sum, line) => sum + (kind === "invoice"
    ? BigInt(line.debitAmount) - BigInt(line.creditAmount) : BigInt(line.creditAmount) - BigInt(line.debitAmount)), 0n));
  const payable = safeInvoiceMinor(BigInt(row.amountPaid) + BigInt(row.amountDue));
  if (original <= 0 || payable <= 0 || (kind === "invoice" && (payable !== row.total || original !== paymentCashBase(payable, row.currencyCode, base, saved.rateExact))))
    unsupported("Recognition and outstanding total are inconsistent");
  if (kind === "bill") {
    const lines = await tx.select().from(billLine).where(eq(billLine.billId, row.id));
    lines.forEach(publicLineDto);
    const subtotal = safeInvoiceMinor(lines.reduce((sum, line) => sum + BigInt(line.amount), 0n));
    const tax = safeInvoiceMinor(lines.reduce((sum, line) => sum + BigInt(line.taxAmount), 0n));
    // Bills do not save the original supplier-payable/tax-kind snapshot. Only
    // total-payable history with a matching single conversion is unambiguous.
    // Reverse-charge and split-GRNI rounding exceptions must not be inferred.
    if (!lines.length || subtotal !== row.subtotal || tax !== row.taxTotal || safeInvoiceMinor(BigInt(subtotal) + BigInt(tax)) !== row.total ||
      payable !== row.total || original !== paymentCashBase(payable, row.currencyCode, base, saved.rateExact))
      unsupported("Bill revaluation requires qualified original supplier payable and control rounding");
  }
  await previousCarrying(tx, ctx, row, { documentId: row.id, documentType: kind, amount: row.amountDue }, control.id, original, payable, base, saved.rateExact);
  return { accountId: control.id, rateExact: saved.rateExact,
    carrying: safeInvoiceMinor(BigInt(original) - invoiceRound(BigInt(original) * BigInt(row.amountPaid), BigInt(payable))) };
}
async function nextNumber(tx: Tx, ctx: AuthContext) {
  const [sequence] = await tx.select().from(numberSequence).where(and(eq(numberSequence.organizationId, ctx.organizationId), eq(numberSequence.entityType, "payment"))).for("update");
  const [max] = sequence ? [] : await tx.select({ value: sql<string>`coalesce(max(nullif(regexp_replace(${payment.paymentNumber}, '^[A-Z]+-', ''), '')::numeric),0)::text` }).from(payment).where(eq(payment.organizationId, ctx.organizationId));
  const value = BigInt(sequence?.lastNumber ?? max.value) + 1n;
  if (value < 1n || value > 2147483647n) unsupported("Payment numbering exceeds int32 capacity");
  if (sequence) await tx.update(numberSequence).set({ lastNumber: Number(value) }).where(eq(numberSequence.id, sequence.id));
  else await tx.insert(numberSequence).values({ organizationId: ctx.organizationId, entityType: "payment", prefix: "PAY", lastNumber: Number(value) });
  return `PAY-${String(value).padStart(5, "0")}`;
}

type SettlementInput = Pay & { amount: number; type: "received" | "made"; allocations: Allocation[]; contactId?: string; currencyCode?: string; notes?: string | null };
/** Shared settlement validation. Observation callers must use a read-only snapshot.
 * Read mode takes no row locks and requires existing bank/FX ledger accounts.
 * It never allocates numbers, accounts, payments, approvals or audit records.
 */
export async function preflightSettlement(tx: Tx, ctx: AuthContext, input: SettlementInput, base: string, readOnly = false) {
    await assertNotLocked(ctx.organizationId, input.date, ctx, tx);
    const docs: { row: Document; allocation: Allocation; carrying: number; rateExact: string; recognition: Awaited<ReturnType<typeof recognition>>; history: unknown[] }[] = [];
    const loaded = [];
    for (const allocation of input.allocations) loaded.push({ row: await loadDocument(tx, ctx, allocation, !readOnly), allocation });
    const control = await receivableAccount(tx, ctx.organizationId, input.type === "received" ? "1200" : "2100");
    if (control.type !== (input.type === "received" ? "asset" : "liability")) unsupported("Invalid settlement control account type");
    let contactId = input.contactId, currency = input.currencyCode;
    for (const { row, allocation } of loaded) {
      contactId ??= row.contactId; currency ??= row.currencyCode;
      if (contactId !== row.contactId || currency !== row.currencyCode) fail("All settlement documents must share the payment contact and currency");
      if (input.date < row.issueDate) fail("Cash settlement cannot predate document recognition");
      const snapshot = "senderSnapshot" in row ? row.senderSnapshot as { baseCurrencyCode?: string } | null : null;
      if (snapshot?.baseCurrencyCode && snapshot.baseCurrencyCode !== base) unsupported("Base currency changed after document recognition");
      const saved = await recognition(tx, ctx, row, allocation.documentType, !readOnly);
      if (readOnly) await assertJournalReferences(ctx.organizationId, saved.lines, saved.entry.fiscalYearId, true, tx);
      if (saved.entry.date !== row.issueDate) unsupported("Recognition posting date differs from the document issue date");
      // Control accounts identify the historical base denomination even for old bills.
      if (control.currencyCode !== base || (currency === base && saved.rateExact !== "1")) unsupported("Recognition base currency is not qualified for this organization");
      const original = safeInvoiceMinor(saved.lines.filter(line => line.accountId === control.id).reduce((sum, line) => sum + (input.type === "received"
        ? BigInt(line.debitAmount) - BigInt(line.creditAmount) : BigInt(line.creditAmount) - BigInt(line.debitAmount)), 0n));
      const payable = safeInvoiceMinor(BigInt(row.amountPaid) + BigInt(row.amountDue));
      if (original <= 0 || payable <= 0 || (allocation.documentType === "invoice" && payable !== row.total)) unsupported("Recognition and document payable are inconsistent");
      if (allocation.documentType === "invoice" && original !== paymentCashBase(payable, currency, base, saved.rateExact))
        unsupported("Invoice recognition no longer covers the outstanding total; additional recognition requires qualification");
      const history = await previousCarrying(tx, ctx, row, allocation, control.id, original, payable, base, saved.rateExact, !readOnly);
      docs.push({ row, allocation, carrying: paymentCarryingBase(original, payable, row.amountPaid, allocation.amount), rateExact: saved.rateExact, recognition: saved, history });
    }
    const partyQuery = tx.select().from(contact).where(and(eq(contact.id, contactId!), eq(contact.organizationId, ctx.organizationId)));
    const [party] = await (readOnly ? partyQuery : partyQuery.for("share"));
    if (!party || party.deletedAt || (input.type === "received" ? party.type === "supplier" : party.type === "customer")) fail("Payment contact is unavailable for this direction");
    // Preflight the contact output before any write (creditLimit can be unsafe history).
    if (party.creditLimit !== null) publicMoneyDto({ amount: party.creditLimit }, ["amount"]);
    let cashAccountId: string;
    let bankSnapshot: typeof bankAccount.$inferSelect | undefined;
    if (input.bankAccountId) {
      const bankQuery = tx.select().from(bankAccount).where(and(eq(bankAccount.id, input.bankAccountId), eq(bankAccount.organizationId, ctx.organizationId)));
      const [bank] = await (readOnly ? bankQuery : bankQuery.for("update"));
      bankSnapshot = bank;
      if (!bank || bank.deletedAt || !bank.isActive || bank.currencyCode !== currency) fail("Payment bank must be active, organization-owned and in the document currency");
      if (readOnly && !bank.chartAccountId) unsupported("Preview requires an existing bank ledger link");
      cashAccountId = readOnly ? bank.chartAccountId! : await ensureBankLedgerAccount(ctx.organizationId, bank, tx);
    } else cashAccountId = (await receivableAccount(tx, ctx.organizationId, "1100")).id;
    const cashAccount = await ownedAccount(tx, ctx, cashAccountId, true, !readOnly);
    if (cashAccount.type !== "asset" || cashAccountId === control.id) unsupported("Settlement cash account must be a distinct active asset account");
    const fx = await createHistoricalRateResolver(ctx.organizationId, tx)(currency!, base, input.date);
    if (!fx) throw new MissingExchangeRateError(currency!, base, input.date);
    const cash = paymentCashBase(input.amount, currency!, base, fx.rateExact);
    if (cash <= 0) unsupported("Cash settlement rounds to zero base minor units");
    const carrying = safeInvoiceMinor(docs.reduce((sum, doc) => sum + BigInt(doc.carrying), 0n));
    const gain = input.type === "received" ? BigInt(cash) - BigInt(carrying) : BigInt(carrying) - BigInt(cash);
    const difference = safeInvoiceMinor(gain < 0n ? -gain : gain);
    const fxAccount = difference ? await receivableAccount(tx, ctx.organizationId, gain > 0n ? "4910" : "5930",
      readOnly ? undefined : { name: gain > 0n ? "Realised Currency Gains" : "Realised Currency Losses", type: gain > 0n ? "revenue" : "expense", subType: "non_operating" }, base) : null;
    if (fxAccount && fxAccount.type !== (gain > 0n ? "revenue" : "expense")) unsupported("Invalid realised FX account type");
    // Both sides and every individual result must remain numerically representable.
    safeInvoiceMinor((input.type === "received" ? BigInt(cash) : BigInt(carrying)) + (gain < 0n ? BigInt(difference) : 0n));
    safeInvoiceMinor((input.type === "received" ? BigInt(carrying) : BigInt(cash)) + (gain > 0n ? BigInt(difference) : 0n));
    return { docs, control, contactId: contactId!, currency: currency!, cashAccountId, cashAccount, fx, cash, carrying, gain, difference, fxAccount, party, bankSnapshot };
}

async function settle(ctx: AuthContext, input: SettlementInput, operation: string, request?: Request, executor?: Tx, permission = "manage:payments"): Promise<Record<string, unknown>> {
  requireRole(ctx, permission);
  const canonical = { operation, type: input.type, contactId: input.contactId ?? null, currencyCode: input.currencyCode ?? null,
    amount: input.amount, date: input.date, method: input.method, reference: input.reference || null, notes: input.notes || null,
    bankAccountId: input.bankAccountId ?? null, allocations: input.allocations };
  const fingerprint = createHash("sha256").update(stringifyWire(canonical)).digest("hex");
  const run = async (tx: Tx) => {
    // All adopted document writers/carriers take this organization lock too.
    // It serializes first numbering, request retries and multi-document settlement.
    const [org] = await tx.select().from(organization).where(eq(organization.id, ctx.organizationId)).for("update");
    if (!org) throw new AuthError("Organization not found", 404);
    if (input.idempotencyKey) {
      const [prior] = await tx.select({ changes: auditLog.changes }).from(auditLog).where(and(eq(auditLog.organizationId, ctx.organizationId),
        eq(auditLog.entityType, "payment"), eq(auditLog.action, "settle"), sql`${auditLog.changes}->>'idempotencyKey' = ${input.idempotencyKey}`));
      if (prior) {
        const saved = prior.changes as { fingerprint: string; result: Record<string, unknown> };
        if (saved.fingerprint !== fingerprint) throw new AuthError("Idempotency key already used for a different settlement", 409);
        stringifyWire(saved.result); return saved.result;
      }
    }
    const base = currencyCodeSchema.parse(org.defaultCurrency ?? "USD");
    const { docs, control, contactId, currency, cashAccountId, fx, cash, gain, difference, fxAccount } = await preflightSettlement(tx, ctx, input, base);
    const [created] = await tx.insert(payment).values({ organizationId: ctx.organizationId, contactId: contactId!,
      paymentNumber: await nextNumber(tx, ctx), type: input.type, date: input.date, amount: input.amount, currencyCode: currency!,
      method: input.method, reference: input.reference || null, notes: input.notes || null, bankAccountId: input.bankAccountId ?? null, createdBy: ctx.userId }).returning();
    await tx.insert(paymentAllocation).values(input.allocations.map(alloc => ({ ...alloc, paymentId: created.id })));
    const [maximum] = await tx.select({ value: sql<string>`coalesce(max(${journalEntry.entryNumber}),0)::text` }).from(journalEntry).where(eq(journalEntry.organizationId, ctx.organizationId));
    const next = BigInt(maximum.value) + 1n; if (next > 2147483647n) unsupported("Journal numbering exceeds int32 capacity");
    const [entry] = await tx.insert(journalEntry).values({ organizationId: ctx.organizationId, entryNumber: Number(next), date: input.date,
      description: `Payment for ${created.paymentNumber}`, reference: created.paymentNumber, sourceType: "payment", sourceId: created.id,
      status: "posted", postedAt: new Date(), createdBy: ctx.userId }).returning();
    const received = input.type === "received";
    const legs = [{ accountId: cashAccountId, description: `Cash ${created.paymentNumber}`, debitAmount: received ? cash : 0, creditAmount: received ? 0 : cash },
      ...docs.map(doc => ({ accountId: control.id, description: memo(doc.row.id), debitAmount: received ? 0 : doc.carrying, creditAmount: received ? doc.carrying : 0 })),
      ...(fxAccount ? [{ accountId: fxAccount.id, description: `Realised FX ${created.paymentNumber}`, debitAmount: gain < 0n ? difference : 0, creditAmount: gain > 0n ? difference : 0 }] : [])];
    await tx.insert(journalLine).values(legs.map(leg => ({ ...leg, journalEntryId: entry.id, currencyCode: currency!,
      exchangeRate: toLegacyRate(fx.rateExact), rateExact: fx.rateExact, rateDirection: "quote_per_base", rateFormatVersion: 1,
      rateMigrationStatus: "exact", rateProvenance: "legacy_scaled_1e6:transaction" })));
    await tx.update(payment).set({ journalEntryId: entry.id, updatedAt: new Date() }).where(eq(payment.id, created.id));
    let updated: Record<string, unknown> | undefined;
    for (const doc of docs) {
      const table = doc.allocation.documentType === "invoice" ? invoice : bill;
      const amountPaid = safeInvoiceMinor(BigInt(doc.row.amountPaid) + BigInt(doc.allocation.amount));
      const amountDue = safeInvoiceMinor(BigInt(doc.row.amountDue) - BigInt(doc.allocation.amount));
      const [row] = await tx.update(table).set({ amountPaid, amountDue, status: amountDue === 0 ? "paid" : "partial",
        paidAt: amountDue === 0 ? new Date() : null, updatedAt: new Date() }).where(and(eq(table.id, doc.row.id), eq(table.organizationId, ctx.organizationId))).returning();
      updated = doc.allocation.documentType === "invoice" ? lifecycleDto(row) : billWriteDto(row);
      await tx.insert(auditLog).values({ organizationId: ctx.organizationId, userId: ctx.userId, entityType: doc.allocation.documentType,
        entityId: doc.row.id, action: "pay", changes: { paymentId: created.id, amountMinor: String(doc.allocation.amount), previousStatus: doc.row.status } });
    }
    const found = await tx.query.payment.findFirst({ where: and(eq(payment.id, created.id), eq(payment.organizationId, ctx.organizationId)), with: { contact: true, allocations: true } });
    if (!found) unsupported("Payment disappeared before serialization");
    const dto = paymentReadDto(found, ctx.organizationId);
    const result = operation === "create" ? { payment: dto } : { [input.type === "received" ? "invoice" : "bill"]: updated,
      payment: publicMoneyDto({ id: dto.id, paymentNumber: dto.paymentNumber, date: dto.date, amount: dto.amount, method: dto.method, currencyCode: dto.currencyCode, journalEntryId: dto.journalEntryId }, ["amount"]) };
    const json = JSON.parse(stringifyWire(result)) as Record<string, unknown>;
    // Durable retry record and audit commit with all money writes. Retaining this
    // audit row is required for retry guarantees; no reference-based guessing.
    await tx.insert(auditLog).values({ organizationId: ctx.organizationId, userId: ctx.userId, entityType: "payment", entityId: created.id, action: "settle",
      changes: { idempotencyKey: input.idempotencyKey ?? null, fingerprint, result: json, baseCurrencyCode: base,
        cashBaseMinor: String(cash), rateExact: fx.rateExact, rateDirection: "quote_per_base", rateEffectiveDate: fx.effectiveDate,
        rateSource: fx.source, rateInverse: fx.inverse, rateProvider: fx.provider,
        rateProviderObservedAt: fx.providerObservedAt, rateImportedAt: fx.importedAt,
        allocations: docs.map(doc => ({ documentId: doc.row.id, amountMinor: String(doc.allocation.amount), carryingBaseMinor: String(doc.carrying), recognitionRateExact: doc.rateExact })) },
      ipAddress: request?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null, userAgent: request?.headers.get("user-agent") || null });
    return json;
  };
  return executor ? run(executor) : db.transaction(run);
}

/** Batch orchestration owns the transaction; never open a second settlement transaction. */
export function createSettlementPaymentInTransaction(ctx: AuthContext, input: unknown, tx: Tx, request?: Request) {
  requireRole(ctx, "manage:payments");
  const parsed = paymentCreateSchema.parse(input), amounts = paymentAllocations(parsed);
  return settle(ctx, { ...parsed, ...amounts }, "create", request, tx);
}

/** Bank matching derives contact/currency from locked documents and owns all bank links. */
export function settleBankDocumentsInTransaction(ctx: AuthContext, input: unknown, tx: Tx, request?: Request) {
  requireRole(ctx, "manage:banking");
  const schema = paymentCreateSchema.omit({ contactId: true, currencyCode: true, notes: true, idempotencyKey: true });
  const parsed = schema.parse(input);
  const amounts = paymentAllocations(parsed);
  return settle(ctx, { ...parsed, ...amounts }, "create", request, tx, "manage:banking");
}

export function createSettlementPayment(ctx: AuthContext, input: unknown, request?: Request) {
  requireRole(ctx, "manage:payments");
  const parsed = paymentCreateSchema.parse(input), amounts = paymentAllocations(parsed);
  return settle(ctx, { ...parsed, ...amounts }, "create", request);
}
export function payDocument(ctx: AuthContext, kind: "invoice" | "bill", id: string, input: unknown, request?: Request) {
  requireRole(ctx, "manage:payments"); z.string().uuid().parse(id);
  const parsed = paymentPaySchema.parse(input), amount = creditAmount(parsed);
  return settle(ctx, { ...parsed, amount, type: kind === "invoice" ? "received" : "made",
    allocations: [{ documentType: kind, documentId: id, amount }] }, `pay:${kind}:${id}`, request);
}
