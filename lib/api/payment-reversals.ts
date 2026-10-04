import { z } from "zod";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { organization, payment, paymentAllocation, contact, bankAccount, bankTransaction, invoice, bill,
  creditNote, debitNote, customerCredit, journalEntry, journalLine, chartAccount, costCenter, project, auditLog } from "@/lib/db/schema";
import { AuthError, type AuthContext } from "./auth-context";
import { requireRole } from "./require-role";
import { assertNotLocked } from "./period-lock";
import { rateDateSchema } from "@/lib/currency/rate-policy";
import { currencyCodeSchema } from "@/lib/currency/zod";
import { WireCompatibilityError, stringifyWire } from "@/lib/money/wire";
import { publicMoneyDto } from "./public-money-wire";
import { lifecycleDto } from "./invoice-lifecycle-wire";
import { billWriteDto } from "./bill-write-wire";
import { journalLineDto } from "./journal-wire";
import { safeInvoiceMinor } from "./invoice-write-wire";
import { reversalBalances } from "./payment-reversal-wire";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Payment = typeof payment.$inferSelect;
function unsupported(message: string): never { throw new WireCompatibilityError(message); }

async function savedJournal(tx: Tx, ctx: AuthContext, id: string | null, sources: string[], sourceId: string, reference?: string) {
  const [entry] = id ? await tx.select().from(journalEntry).where(and(eq(journalEntry.id, id), eq(journalEntry.organizationId, ctx.organizationId))).for("update") : [];
  if (!entry || entry.deletedAt || entry.status !== "posted" || entry.reversedByEntryId || entry.reversesEntryId ||
    !sources.includes(entry.sourceType ?? "") || (entry.sourceId !== null ? entry.sourceId !== sourceId : entry.reference !== reference))
    unsupported("Reversal requires its own posted, unreversed organization journal");
  rateDateSchema.parse(entry.date);
  const lines = await tx.select().from(journalLine).where(eq(journalLine.journalEntryId, entry.id)).for("update");
  let debit = 0n, credit = 0n;
  for (const line of lines) {
    journalLineDto(line); currencyCodeSchema.parse(line.currencyCode);
    if (!line.rateExact || line.rateMigrationStatus !== "exact" || line.rateDirection !== "quote_per_base" || line.rateFormatVersion !== 1 ||
      line.debitAmount < 0 || line.creditAmount < 0 || (line.debitAmount && line.creditAmount))
      unsupported("Reversal requires qualified saved amounts and exact FX; no historical repair");
    const [account] = await tx.select({ id: chartAccount.id }).from(chartAccount).where(and(eq(chartAccount.id, line.accountId), eq(chartAccount.organizationId, ctx.organizationId))).for("share");
    if (!account) unsupported("Saved journal account belongs to another organization");
    for (const [key, table] of [["costCenterId", costCenter], ["projectId", project]] as const) {
      if (!line[key]) continue;
      const [dimension] = await tx.select({ id: table.id }).from(table).where(and(eq(table.id, line[key]!), eq(table.organizationId, ctx.organizationId))).for("share");
      if (!dimension) unsupported(`Saved journal ${key} belongs to another organization`);
    }
    debit += BigInt(line.debitAmount); credit += BigInt(line.creditAmount);
  }
  safeInvoiceMinor(debit); safeInvoiceMinor(credit);
  if (debit <= 0n || debit !== credit) unsupported("Saved reversal journal must have positive balanced safe totals");
  return { entry, lines };
}

async function reverseSaved(tx: Tx, ctx: AuthContext, row: Payment, saved: Awaited<ReturnType<typeof savedJournal>>) {
  if (saved.entry.date !== row.date || saved.lines.some(line => line.currencyCode !== row.currencyCode))
    unsupported("Payment and saved journal dates or currencies disagree");
  await assertNotLocked(ctx.organizationId, saved.entry.date);
  const [max] = await tx.select({ value: sql<string>`coalesce(max(${journalEntry.entryNumber}),0)::text` }).from(journalEntry).where(eq(journalEntry.organizationId, ctx.organizationId));
  const next = BigInt(max.value) + 1n;
  if (next < 1n || next > 2147483647n) unsupported("Reversal journal numbering exceeds int32 capacity");
  const description = `Reversal of payment ${row.paymentNumber}`;
  const [reversal] = await tx.insert(journalEntry).values({ organizationId: ctx.organizationId, entryNumber: Number(next), date: row.date,
    description, reference: row.paymentNumber, status: "posted", sourceType: "payment_void", sourceId: row.id,
    reversesEntryId: saved.entry.id, postedAt: new Date(), createdBy: ctx.userId }).returning();
  // Copy historical FX and dimensions verbatim. Never resolve today's rates.
  await tx.insert(journalLine).values(saved.lines.map(line => ({
    journalEntryId: reversal.id, description, debitAmount: line.creditAmount, creditAmount: line.debitAmount,
    accountId: line.accountId, currencyCode: line.currencyCode, exchangeRate: line.exchangeRate, rateExact: line.rateExact,
    rateDirection: line.rateDirection, rateFormatVersion: line.rateFormatVersion, rateMigrationStatus: line.rateMigrationStatus,
    rateProvenance: line.rateProvenance, costCenterId: line.costCenterId, projectId: line.projectId,
  })));
  await tx.update(journalEntry).set({ reversedByEntryId: reversal.id, updatedAt: new Date() }).where(and(eq(journalEntry.id, saved.entry.id), eq(journalEntry.organizationId, ctx.organizationId)));
  return reversal.id;
}

async function activeAllocationTotal(tx: Tx, ctx: AuthContext, row: Payment, kind: string, id: string) {
  const history = await tx.select({ allocation: paymentAllocation, payment }).from(paymentAllocation)
    .innerJoin(payment, eq(payment.id, paymentAllocation.paymentId))
    .where(and(eq(paymentAllocation.documentType, kind), eq(paymentAllocation.documentId, id), isNull(payment.deletedAt))).for("update");
  let total = 0n;
  for (const h of history) {
    publicMoneyDto(h.payment, ["amount"]); publicMoneyDto(h.allocation, ["amount"]);
    if (h.payment.organizationId !== ctx.organizationId || h.payment.contactId !== row.contactId || h.payment.currencyCode !== row.currencyCode ||
      h.payment.type !== row.type || h.allocation.amount <= 0) unsupported("Active allocations are inconsistent or belong to another organization");
    total += BigInt(h.allocation.amount);
  }
  return safeInvoiceMinor(total);
}

export async function deletePayment(ctx: AuthContext, id: string, request?: Request) {
  requireRole(ctx, "manage:payments"); z.string().uuid().parse(id);
  return db.transaction(tx => reversePaymentInTransaction(tx, ctx, id, request));
}

/** Internal bank undo entry point: shares the caller's organization lock and transaction. */
export async function reversePaymentInTransaction(tx: Tx, ctx: AuthContext, id: string, request?: Request, bankTransactionId?: string) {
  requireRole(ctx, bankTransactionId ? "manage:banking" : "manage:payments"); z.string().uuid().parse(id);
  const [org] = await tx.select({ id: organization.id }).from(organization).where(eq(organization.id, ctx.organizationId)).for("update");
  if (!org) throw new AuthError("Organization not found", 404);
  const [row] = await tx.select().from(payment).where(and(eq(payment.id, id), eq(payment.organizationId, ctx.organizationId), isNull(payment.deletedAt))).for("update");
  if (!row) throw new AuthError("Payment not found", 404);
  const before = publicMoneyDto(row, ["amount"]);
  currencyCodeSchema.parse(row.currencyCode); rateDateSchema.parse(row.date);
  if (row.amount <= 0) unsupported("Only positive qualified cash or noncash carrier payments can be reversed");
  await assertNotLocked(ctx.organizationId, row.date);
  const [party] = await tx.select().from(contact).where(and(eq(contact.id, row.contactId), eq(contact.organizationId, ctx.organizationId))).for("share");
  if (!party) unsupported("Payment contact belongs to another organization");
  if (party.creditLimit !== null) publicMoneyDto(party, ["creditLimit"]);
  // Reconciled/provider-backed money needs its dedicated unmatch/refund flow.
  const linked = row.journalEntryId ? await tx.select({ id: bankTransaction.id }).from(bankTransaction)
    .where(eq(bankTransaction.journalEntryId, row.journalEntryId)).for("update") : [];
  if (row.stripePaymentIntentId || (bankTransactionId
    ? row.bankTransactionId !== bankTransactionId || linked.length !== 1 || linked[0].id !== bankTransactionId
    : row.bankTransactionId || linked.length))
    throw new AuthError("Unmatch bank-linked payments or use the provider refund workflow before deletion", 409);
  if (row.bankAccountId) {
    const [bank] = await tx.select().from(bankAccount).where(and(eq(bankAccount.id, row.bankAccountId), eq(bankAccount.organizationId, ctx.organizationId))).for("share");
    if (!bank || bank.currencyCode !== row.currencyCode) unsupported("Payment bank belongs to another organization or currency");
    publicMoneyDto(bank, ["balance"]); if (bank.lowBalanceThreshold !== null) publicMoneyDto(bank, ["lowBalanceThreshold"]);
  }
  const allocations = await tx.select().from(paymentAllocation).where(eq(paymentAllocation.paymentId, id)).orderBy(paymentAllocation.documentId).for("update");
  allocations.forEach(a => publicMoneyDto(a, ["amount"]));
  if (!allocations.length || allocations.some(a => a.amount <= 0) || new Set(allocations.map(a => `${a.documentType}:${a.documentId}`)).size !== allocations.length)
    unsupported("Payment needs distinct positive saved allocations");
  const kind = row.type === "received" ? "invoice" : "bill";
  const documents = allocations.filter(a => a.documentType === kind);
  const carriers = allocations.filter(a => ["credit_note", "debit_note", "prepayment"].includes(a.documentType));
  const carrier = carriers[0];
  if (bankTransactionId && carrier) unsupported("Noncash carriers cannot be unwound by cash bank reconciliation");
  if (carrier) {
    const permitted = row.type === "received" ? ["credit_note", "prepayment"] : ["debit_note"];
    if (carriers.length !== 1 || documents.length !== 1 || allocations.length !== 2 || allocations.some(a => a.amount !== row.amount) ||
      !permitted.includes(carrier.documentType) ||
      row.bankAccountId || row.method !== "other" || (carrier.documentType !== "prepayment" && row.journalEntryId))
      unsupported("Noncash carrier must have a matching note/prepayment and document pair without bank references");
  } else if (documents.length !== allocations.length || !row.journalEntryId || documents.reduce((s, a) => s + BigInt(a.amount), 0n) !== BigInt(row.amount))
    unsupported("Cash allocations must fully cover the payment and have a saved journal");
  const changes: Record<string, unknown>[] = [];
  for (const alloc of documents) {
    const table = kind === "invoice" ? invoice : bill;
    const [doc] = await tx.select().from(table).where(and(eq(table.id, alloc.documentId), eq(table.organizationId, ctx.organizationId), isNull(table.deletedAt))).for("update");
    if (!doc) unsupported("Allocated document is unavailable in this organization");
    const old = kind === "invoice" ? lifecycleDto(doc) : billWriteDto(doc);
    rateDateSchema.parse(doc.issueDate);
    if (doc.contactId !== row.contactId || doc.currencyCode !== row.currencyCode || !["sent", "received", "partial", "paid", "overdue"].includes(doc.status) || !doc.journalEntryId)
      unsupported("Allocated document identity, recognition or status is inconsistent");
    const [recognition] = await tx.select().from(journalEntry).where(and(eq(journalEntry.id, doc.journalEntryId), eq(journalEntry.organizationId, ctx.organizationId))).for("share");
    if (!recognition || recognition.deletedAt || recognition.reversedByEntryId || recognition.status !== "posted" ||
      !(kind === "invoice" ? ["invoice"] : ["bill", "bill_grni"]).includes(recognition.sourceType ?? "") ||
      (recognition.sourceId !== null ? recognition.sourceId !== doc.id : recognition.reference !== ("invoiceNumber" in doc ? doc.invoiceNumber : doc.billNumber)))
      unsupported("Document recognition is unavailable or foreign");
    const payable = BigInt(doc.amountPaid) + BigInt(doc.amountDue);
    if (payable <= 0n || (kind === "invoice" ? payable !== BigInt(doc.total) : payable > BigInt(doc.total)) ||
      await activeAllocationTotal(tx, ctx, row, kind, doc.id) !== doc.amountPaid)
      unsupported("Document paid balance and active allocations disagree");
    await assertNotLocked(ctx.organizationId, doc.issueDate);
    const balances = reversalBalances(doc.amountPaid, doc.amountDue, alloc.amount);
    const [updated] = await tx.update(table).set({ ...balances, status: balances.amountPaid === 0 ? kind === "invoice" ? "sent" : "received" : "partial",
      paidAt: null, updatedAt: new Date() }).where(and(eq(table.id, doc.id), eq(table.organizationId, ctx.organizationId))).returning();
    changes.push({ entityType: kind, entityId: doc.id, before: old, after: kind === "invoice" ? lifecycleDto(updated) : billWriteDto(updated), amountMinor: String(alloc.amount) });
  }
  let journal: Awaited<ReturnType<typeof savedJournal>> | undefined;
  if (carrier) {
    if (carrier.documentType === "prepayment") {
      const [credit] = await tx.select().from(customerCredit).where(and(eq(customerCredit.id, carrier.documentId), eq(customerCredit.organizationId, ctx.organizationId), isNull(customerCredit.deletedAt))).for("update");
      if (!credit || !["open", "applied"].includes(credit.status) || credit.contactId !== row.contactId || credit.currencyCode !== row.currencyCode)
        unsupported("Prepayment carrier credit is unavailable or foreign");
      const old = publicMoneyDto(credit, ["originalAmount", "amountRemaining"]); rateDateSchema.parse(credit.date);
      await assertNotLocked(ctx.organizationId, credit.date);
      const applied = safeInvoiceMinor(BigInt(credit.originalAmount) - BigInt(credit.amountRemaining));
      if (await activeAllocationTotal(tx, ctx, row, "prepayment", credit.id) !== applied) unsupported("Prepayment balance and active allocations disagree");
      const restored = reversalBalances(applied, credit.amountRemaining, carrier.amount);
      journal = await savedJournal(tx, ctx, row.journalEntryId, ["customer_credit_application"], credit.id, row.reference ?? undefined);
      const [updated] = await tx.update(customerCredit).set({ amountRemaining: restored.amountDue, status: "open", updatedAt: new Date() })
        .where(and(eq(customerCredit.id, credit.id), eq(customerCredit.organizationId, ctx.organizationId))).returning();
      changes.push({ entityType: "customer_credit", entityId: credit.id, before: old, after: publicMoneyDto(updated, ["originalAmount", "amountRemaining"]) });
    } else {
      const table = carrier.documentType === "credit_note" ? creditNote : debitNote;
      const [note] = await tx.select().from(table).where(and(eq(table.id, carrier.documentId), eq(table.organizationId, ctx.organizationId), isNull(table.deletedAt))).for("update");
      if (!note || !["sent", "applied"].includes(note.status) || note.contactId !== row.contactId || note.currencyCode !== row.currencyCode || note.issueDate !== row.date)
        unsupported("Noncash carrier note is unavailable or inconsistent");
      const old = publicMoneyDto(note, ["total", "amountApplied", "amountRemaining"]);
      if (BigInt(note.amountApplied) + BigInt(note.amountRemaining) !== BigInt(note.total) ||
        await activeAllocationTotal(tx, ctx, row, carrier.documentType, note.id) !== note.amountApplied)
        unsupported("Note balances and active allocations disagree");
      await assertNotLocked(ctx.organizationId, note.issueDate);
      await savedJournal(tx, ctx, note.journalEntryId, [carrier.documentType, `${carrier.documentType}_issue`], note.id,
        "creditNoteNumber" in note ? note.creditNoteNumber : note.debitNoteNumber);
      const restored = reversalBalances(note.amountApplied, note.amountRemaining, carrier.amount);
      const [updated] = await tx.update(table).set({ amountApplied: restored.amountPaid, amountRemaining: restored.amountDue, status: "sent", updatedAt: new Date() })
        .where(and(eq(table.id, note.id), eq(table.organizationId, ctx.organizationId))).returning();
      changes.push({ entityType: carrier.documentType, entityId: note.id, before: old, after: publicMoneyDto(updated, ["total", "amountApplied", "amountRemaining"]) });
    }
  } else journal = await savedJournal(tx, ctx, row.journalEntryId, ["payment"], id, row.paymentNumber);
  const reversalEntryId = journal ? await reverseSaved(tx, ctx, row, journal) : null;
  const [deleted] = await tx.update(payment).set({ deletedAt: new Date(), updatedAt: new Date(), ...(bankTransactionId ? { bankTransactionId: null } : {}) }).where(and(eq(payment.id, id), eq(payment.organizationId, ctx.organizationId))).returning();
  const result = { success: true };
  const audit = JSON.parse(stringifyWire({ before, after: publicMoneyDto(deleted, ["amount"]),
    allocations: allocations.map(a => publicMoneyDto(a, ["amount"])), reversalEntryId, documents: changes, result }));
  await tx.insert(auditLog).values({ organizationId: ctx.organizationId, userId: ctx.userId, entityType: "payment", entityId: id,
    action: "delete", changes: audit, ipAddress: request?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null, userAgent: request?.headers.get("user-agent") || null });
  return bankTransactionId ? { ...result, reversalEntryId, reversedAllocations: documents.length } : result;
}
