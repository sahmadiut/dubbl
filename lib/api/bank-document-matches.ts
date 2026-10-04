import { and, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { organization, bankAccount, bankTransaction, payment, paymentAllocation, journalEntry, journalLine, chartAccount,
  contact, costCenter, project, invoice, bill, auditLog, expenseClaim, customerCredit } from "@/lib/db/schema";
import { AuthError, type AuthContext } from "./auth-context";
import { requireRole } from "./require-role";
import { assertNotLocked } from "./period-lock";
import { bankMatchId, bankDocumentMatchSchema, bankDocumentSplitSchema, bankDocumentAllocations } from "./bank-document-match-wire";
import { creditAmount } from "./credit-wire";
import { settleBankDocumentsInTransaction } from "./payment-settlements";
import { paymentCashBase } from "./payment-settlement-wire";
import { bankReadCurrency, sameBankReadCurrency, bankReadNullableMoney } from "./bank-transaction-read-wire";
import { bankReadSnapshot, bankReadTransaction } from "./bank-transaction-reads";
import { publicMoneyDto } from "./public-money-wire";
import { journalLineDto } from "./journal-wire";
import { legacyMinor, stringifyWire, WireCompatibilityError } from "@/lib/money/wire";
import { rateDateSchema } from "@/lib/currency/rate-policy";
import { toLegacyRate } from "@/lib/currency/exact-rate";
import { bandFor } from "./bank-ledger-codes";
import { findMatches } from "@/lib/banking/reconciliation-matcher";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
function fail(message: string): never { throw new AuthError(message, 400); }
function unsupported(message: string): never { throw new WireCompatibilityError(message); }

async function load(tx: Tx, ctx: AuthContext, id: string) {
  const [org] = await tx.select().from(organization).where(eq(organization.id, ctx.organizationId)).for("update");
  if (!org) throw new AuthError("Organization not found", 404);
  const [parent] = await tx.select({ id: bankAccount.id }).from(bankTransaction).innerJoin(bankAccount, eq(bankAccount.id, bankTransaction.bankAccountId))
    .where(and(eq(bankTransaction.id, id), eq(bankAccount.organizationId, ctx.organizationId), isNull(bankAccount.deletedAt)));
  if (!parent) throw new AuthError("Bank transaction not found", 404);
  const [bank] = await tx.select().from(bankAccount).where(and(eq(bankAccount.id, parent.id), eq(bankAccount.organizationId, ctx.organizationId), isNull(bankAccount.deletedAt))).for("update");
  if (!bank) throw new AuthError("Bank transaction not found", 404);
  const [row] = await tx.select().from(bankTransaction).where(and(eq(bankTransaction.id, id), eq(bankTransaction.bankAccountId, bank.id))).for("update");
  if (!row) throw new AuthError("Bank transaction not found", 404);
  const currency = sameBankReadCurrency(row.currencyCode, bank.currencyCode), base = bankReadCurrency(org.defaultCurrency);
  bankReadNullableMoney(row, ["amount", "balance"]); rateDateSchema.parse(row.date);
  if (!bank.isActive || row.status !== "unreconciled" || !row.amount || row.journalEntryId || row.reconciliationId || row.transferTransactionId || row.transferGroupId || row.sourceType === "transfer")
    fail("Matching requires an active bank and a nonzero, unlinked unreconciled statement line");
  const [linked] = await tx.select({ id: payment.id }).from(payment).where(and(eq(payment.bankTransactionId, id), isNull(payment.deletedAt)));
  const [claim] = await tx.select({ id: expenseClaim.id }).from(auditLog).innerJoin(expenseClaim, eq(expenseClaim.id, auditLog.entityId))
    .where(and(eq(auditLog.organizationId, ctx.organizationId), eq(auditLog.entityType, "expense"), eq(expenseClaim.organizationId, ctx.organizationId),
      isNull(expenseClaim.deletedAt), sql`${auditLog.changes}->>'bankTransactionId' = ${id}`));
  if (linked || claim) fail("Statement line already has payment or expense history; resolve that history first");
  await assertNotLocked(ctx.organizationId, row.date, ctx);
  if (bank.chartAccountId) await bankGl(tx, ctx, bank, currency);
  return { bank, row, currency, base, magnitude: legacyMinor(row.amount < 0 ? -BigInt(row.amount) : BigInt(row.amount)) };
}
async function bankGl(tx: Tx, ctx: AuthContext, bank: typeof bankAccount.$inferSelect, currency: string) {
  if (!bank.chartAccountId) unsupported("Existing-record matching requires a saved bank GL link");
  const [gl] = await tx.select().from(chartAccount).where(and(eq(chartAccount.id, bank.chartAccountId), eq(chartAccount.organizationId, ctx.organizationId))).for("share");
  if (!gl) throw new AuthError("Bank GL account not found", 404);
  const [other] = await tx.select({ id: bankAccount.id }).from(bankAccount).where(and(eq(bankAccount.organizationId, ctx.organizationId), eq(bankAccount.chartAccountId, gl.id), ne(bankAccount.id, bank.id)));
  if (other || gl.deletedAt || !gl.isActive || gl.type !== bandFor(bank.accountType).type || gl.currencyCode !== currency)
    unsupported("Bank GL must be active, exclusively linked and correctly denominated");
  return gl;
}
async function savedJournal(tx: Tx, ctx: AuthContext, id: string, state: Awaited<ReturnType<typeof load>>, cashPayment?: typeof payment.$inferSelect) {
  const [entry] = await tx.select().from(journalEntry).where(and(eq(journalEntry.id, id), eq(journalEntry.organizationId, ctx.organizationId))).for("update");
  if (!entry) throw new AuthError("Journal entry not found", 404);
  if (entry.deletedAt || entry.status !== "posted" || entry.reversedByEntryId) fail("Matching requires an unreversed posted journal");
  rateDateSchema.parse(entry.date); await assertNotLocked(ctx.organizationId, entry.date, ctx);
  const [linked] = await tx.select({ id: bankTransaction.id }).from(bankTransaction).where(eq(bankTransaction.journalEntryId, id));
  if (linked) fail("Journal is already linked to another statement line");
  const lines = await tx.select().from(journalLine).where(eq(journalLine.journalEntryId, id));
  if (lines.length < 2) unsupported("Journal has incomplete history");
  const gl = await bankGl(tx, ctx, state.bank, state.currency);
  let debit = 0n, credit = 0n, cash = 0n;
  const rate = lines[0].rateExact;
  if (!rate) unsupported("Journal lacks saved exact FX");
  let numericRate: number;
  try { numericRate = toLegacyRate(rate); }
  catch { unsupported("Saved FX is outside the supported legacy millionths range"); }
  for (const line of lines) {
    journalLineDto(line);
    if (line.debitAmount < 0 || line.creditAmount < 0 || (line.debitAmount && line.creditAmount) || line.rateExact !== rate ||
      line.exchangeRate !== numericRate || line.currencyCode !== state.currency || line.rateDirection !== "quote_per_base" || line.rateMigrationStatus !== "exact" || line.rateFormatVersion !== 1)
      unsupported("Journal has inconsistent amounts or saved FX");
    const [account] = await tx.select({ id: chartAccount.id }).from(chartAccount).where(and(eq(chartAccount.id, line.accountId), eq(chartAccount.organizationId, ctx.organizationId)));
    if (!account) unsupported("Journal references a foreign GL account");
    if (line.costCenterId) {
      const [dimension] = await tx.select({ id: costCenter.id }).from(costCenter).where(and(eq(costCenter.id, line.costCenterId), eq(costCenter.organizationId, ctx.organizationId)));
      if (!dimension) unsupported("Journal references a foreign cost center");
    }
    if (line.projectId) {
      const [dimension] = await tx.select({ id: project.id }).from(project).where(and(eq(project.id, line.projectId), eq(project.organizationId, ctx.organizationId)));
      if (!dimension) unsupported("Journal references a foreign project");
    }
    debit += BigInt(line.debitAmount); credit += BigInt(line.creditAmount);
    if (line.accountId === gl.id) cash += BigInt(line.debitAmount) - BigInt(line.creditAmount);
  }
  legacyMinor(debit); legacyMinor(credit); legacyMinor(cash);
  if (!debit || debit !== credit) unsupported("Journal must balance with safe numeric totals");
  const expected = paymentCashBase(state.magnitude, state.currency, state.base, rate);
  if (!expected || cash !== BigInt(state.row.amount > 0 ? expected : -expected)) fail("Journal bank leg does not match the statement amount and direction");
  if (cashPayment) {
    if (entry.sourceType !== "payment" || entry.sourceId !== cashPayment.id || entry.date !== cashPayment.date) unsupported("Cash payment lacks its own saved posting history");
    const [audit] = await tx.select({ changes: auditLog.changes }).from(auditLog).where(and(eq(auditLog.organizationId, ctx.organizationId), eq(auditLog.entityType, "payment"), eq(auditLog.entityId, cashPayment.id), eq(auditLog.action, "settle")));
    const saved = audit?.changes as { baseCurrencyCode?: string; cashBaseMinor?: string; rateExact?: string;
      allocations?: { documentId: string; amountMinor: string; carryingBaseMinor: string }[] } | null;
    if (saved?.baseCurrencyCode !== state.base || saved.cashBaseMinor !== String(expected) || saved.rateExact !== rate || !Array.isArray(saved.allocations))
      unsupported("Payment cash/FX/base-currency history is missing or changed");
    const allocations = await tx.select().from(paymentAllocation).where(eq(paymentAllocation.paymentId, cashPayment.id));
    const [control] = await tx.select({ id: chartAccount.id }).from(chartAccount).where(and(eq(chartAccount.organizationId, ctx.organizationId), eq(chartAccount.code, cashPayment.type === "received" ? "1200" : "2100")));
    if (!control || saved.allocations.length !== allocations.length) unsupported("Payment carrying history is incomplete");
    for (const allocation of allocations) {
      const records = saved.allocations.filter(a => a.documentId === allocation.documentId);
      const legs = lines.filter(l => l.accountId === control.id && l.description === `Settlement document ${allocation.documentId}`);
      if (records.length !== 1 || legs.length !== 1 || records[0].amountMinor !== String(allocation.amount) || records[0].carryingBaseMinor !== String(cashPayment.type === "received"
        ? legs[0].creditAmount - legs[0].debitAmount : legs[0].debitAmount - legs[0].creditAmount)) unsupported("Payment allocations no longer agree with saved carrying legs");
    }
  } else {
    if (state.currency !== state.base || rate !== "1") unsupported("Direct journal matching supports identity FX in base-currency banks only; use existing-payment matching for foreign cash");
    const [paymentLink] = await tx.select({ id: payment.id }).from(payment).where(eq(payment.journalEntryId, id));
    const [expenseLink] = await tx.select({ id: expenseClaim.id }).from(expenseClaim).where(eq(expenseClaim.journalEntryId, id));
    if (paymentLink || expenseLink || ["payment", "bank_transfer", "credit_note", "debit_note", "customer_credit_application"].includes(entry.sourceType ?? ""))
      fail("Use the owning cash workflow to match this journal; noncash and transfer history cannot be relabelled");
    if (entry.sourceType === "customer_credit") {
      const [deposit] = await tx.select().from(customerCredit).where(and(eq(customerCredit.id, entry.sourceId!), eq(customerCredit.organizationId, ctx.organizationId), isNull(customerCredit.deletedAt))).for("share");
      if (!deposit || deposit.journalEntryId !== id || deposit.currencyCode !== state.currency || deposit.date !== entry.date || state.row.amount < 0) unsupported("Deposit cash history is unavailable or foreign");
      publicMoneyDto(deposit, ["originalAmount", "amountRemaining"]);
      if (deposit.originalAmount !== state.magnitude) fail("Deposit cash receipt differs from statement amount");
    }
  }
  return entry;
}
async function audit(tx: Tx, ctx: AuthContext, id: string, action: string, changes: Record<string, unknown>, request?: Request) {
  stringifyWire(changes);
  await tx.insert(auditLog).values({ organizationId: ctx.organizationId, userId: ctx.userId, entityType: "bank_transaction", entityId: id, action, changes,
    ipAddress: request?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null, userAgent: request?.headers.get("user-agent") || null });
}

export async function matchBankDocument(ctx: AuthContext, id: string, input: unknown, request?: Request) {
  requireRole(ctx, "manage:banking"); bankMatchId.parse(id);
  const parsed = bankDocumentMatchSchema.parse(input);
  if (parsed.invoiceId || parsed.billId) {
    const kind = parsed.invoiceId ? "invoice" : "bill", amount = creditAmount(parsed);
    const result = await splitBankDocuments(ctx, id, { date: parsed.date, method: parsed.method,
      allocations: [{ documentType: kind, documentId: parsed.invoiceId ?? parsed.billId, amount }] }, request);
    return { payment: result.payment, [kind === "invoice" ? "invoiceStatus" : "billStatus"]: result.allocations[0].newStatus };
  }
  return db.transaction(async tx => {
    const state = await load(tx, ctx, id);
    if (parsed.paymentId) {
      const [found] = await tx.select().from(payment).where(and(eq(payment.id, parsed.paymentId), eq(payment.organizationId, ctx.organizationId), isNull(payment.deletedAt))).for("update");
      if (!found) throw new AuthError("Payment not found", 404);
      publicMoneyDto(found, ["amount"]);
      if (found.bankTransactionId || found.bankAccountId !== state.bank.id || found.currencyCode !== state.currency || found.amount !== state.magnitude ||
        found.type !== (state.row.amount > 0 ? "received" : "made")) fail("Existing payment must be unlinked cash of the same bank, currency, amount and direction");
      const allocations = await tx.select().from(paymentAllocation).where(eq(paymentAllocation.paymentId, found.id));
      if (!found.journalEntryId || !allocations.length || allocations.some(a => a.documentType !== (found.type === "received" ? "invoice" : "bill")))
        fail("Noncash carriers and unposted payments cannot match cash statements");
      for (const allocation of allocations) {
        publicMoneyDto(allocation, ["amount"]);
        const table = allocation.documentType === "invoice" ? invoice : bill;
        const [doc] = await tx.select().from(table).where(and(eq(table.id, allocation.documentId), eq(table.organizationId, ctx.organizationId), isNull(table.deletedAt))).for("share");
        if (!doc || doc.contactId !== found.contactId || doc.currencyCode !== found.currencyCode || allocation.amount <= 0) unsupported("Payment has inconsistent document allocations");
      }
      if (new Set(allocations.map(a => a.documentId)).size !== allocations.length || allocations.reduce((sum, a) => sum + BigInt(a.amount), 0n) !== BigInt(found.amount)) unsupported("Payment allocations do not cover saved cash");
      const [party] = await tx.select({ id: contact.id }).from(contact).where(and(eq(contact.id, found.contactId), eq(contact.organizationId, ctx.organizationId), isNull(contact.deletedAt)));
      if (!party) unsupported("Payment contact is unavailable or foreign");
      const entry = await savedJournal(tx, ctx, found.journalEntryId, state, found);
      await tx.update(payment).set({ bankTransactionId: id, updatedAt: new Date() }).where(eq(payment.id, found.id));
      await tx.update(bankTransaction).set({ status: "reconciled", journalEntryId: entry.id, contactId: found.contactId }).where(eq(bankTransaction.id, id));
      await audit(tx, ctx, id, "matched_existing_payment", { paymentId: found.id, journalEntryId: entry.id, amount: found.amount, amountMinor: String(found.amount) }, request);
      return { matchType: "existing_payment", paymentId: found.id, journalEntryId: entry.id };
    }
    const entry = await savedJournal(tx, ctx, parsed.journalEntryId!, state);
    await tx.update(bankTransaction).set({ status: "reconciled", journalEntryId: entry.id }).where(eq(bankTransaction.id, id));
    await audit(tx, ctx, id, "matched_existing_journal", { journalEntryId: entry.id }, request);
    return { matchType: "existing_journal", journalEntryId: entry.id };
  });
}

export async function splitBankDocuments(ctx: AuthContext, id: string, input: unknown, request?: Request) {
  requireRole(ctx, "manage:banking"); bankMatchId.parse(id);
  const parsed = bankDocumentSplitSchema.parse(input), { amount, allocations } = bankDocumentAllocations(parsed);
  return db.transaction(async tx => {
    const state = await load(tx, ctx, id);
    if (amount !== state.magnitude) fail("Document allocations must cover the entire statement amount; partial reconciliation is unsupported");
    const kind = state.row.amount > 0 ? "invoice" : "bill";
    if (allocations.some(a => a.documentType !== kind)) fail("Document type must agree with statement direction");
    const date = parsed.date ?? state.row.date;
    const settled = await settleBankDocumentsInTransaction(ctx, { amount, allocations, date, method: parsed.method,
      bankAccountId: state.bank.id, type: kind === "invoice" ? "received" : "made" }, tx, request);
    const created = settled.payment as { id: string; paymentNumber: string; amount: number; amountMinor: string; journalEntryId: string; currencyCode: string; contactId: string };
    if (created.currencyCode !== state.currency) unsupported("Settlement currency differs from the statement");
    await tx.update(payment).set({ bankTransactionId: id, updatedAt: new Date() }).where(eq(payment.id, created.id));
    await tx.update(bankTransaction).set({ status: "reconciled", journalEntryId: created.journalEntryId, contactId: created.contactId }).where(eq(bankTransaction.id, id));
    const results = [];
    for (const allocation of allocations) {
      const table = kind === "invoice" ? invoice : bill;
      const [doc] = await tx.select({ status: table.status }).from(table).where(eq(table.id, allocation.documentId));
      results.push({ ...allocation, amountMinor: String(allocation.amount), newStatus: doc.status });
    }
    const result = { payment: { id: created.id, paymentNumber: created.paymentNumber, amount: created.amount, amountMinor: created.amountMinor,
      currencyCode: created.currencyCode, journalEntryId: created.journalEntryId }, allocations: results };
    stringifyWire(result);
    await audit(tx, ctx, id, allocations.length === 1 ? `matched_${kind}` : "split_matched", { allocations: results, paymentId: created.id, baseCurrencyCode: state.base }, request);
    return result;
  });
}

export async function getBankInvoiceMatches(ctx: AuthContext, id: string) {
  requireRole(ctx, "manage:banking"); bankMatchId.parse(id);
  return bankReadSnapshot(async tx => {
    const { transaction, account } = await bankReadTransaction(tx, ctx, id);
    const summary = publicMoneyDto({ id: transaction.id, date: transaction.date, description: transaction.description, amount: transaction.amount,
      reference: transaction.reference, currencyCode: account.currencyCode }, ["amount"]);
    if (transaction.amount <= 0) return { transaction: summary, suggestedMatches: [], openInvoices: [] };
    const rows = await tx.query.invoice.findMany({ where: and(eq(invoice.organizationId, ctx.organizationId), eq(invoice.currencyCode, account.currencyCode),
      isNull(invoice.deletedAt), inArray(invoice.status, ["sent", "partial", "overdue"])), with: { contact: { columns: { name: true, organizationId: true } } }, limit: 50, orderBy: invoice.id });
    for (const row of rows) {
      publicMoneyDto(row, ["total", "amountDue", "amountPaid"]);
      if (!row.contact || row.contact.organizationId !== ctx.organizationId) unsupported("Invoice has unavailable or foreign contact");
    }
    const matches = findMatches(transaction, rows.map(row => ({ type: "invoice", id: row.id, date: row.dueDate,
      description: `${row.invoiceNumber} - ${row.contact!.name}`, amount: row.amountDue, reference: row.reference || row.invoiceNumber })), [], []);
    return { transaction: summary, suggestedMatches: matches.map(row => ({ ...row, candidate: publicMoneyDto(row.candidate, ["amount"]) })), openInvoices: rows.map(row => publicMoneyDto({
      id: row.id, invoiceNumber: row.invoiceNumber, contactName: row.contact!.name, dueDate: row.dueDate, total: row.total, amountDue: row.amountDue, status: row.status, currencyCode: row.currencyCode }, ["total", "amountDue"])) };
  });
}
