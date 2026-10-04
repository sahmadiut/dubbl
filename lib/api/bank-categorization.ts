import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { organization, bankAccount, bankTransaction, chartAccount, contact, taxRate, taxComponent, costCenter, project,
  payment, expenseClaim, expenseItem, journalEntry, journalLine, auditLog } from "@/lib/db/schema";
import { AuthError, type AuthContext } from "./auth-context";
import { requireRole } from "./require-role";
import { assertNotLocked } from "./period-lock";
import { ensureBankLedgerAccount } from "./bank-ledger";
import { bandFor } from "./bank-ledger-codes";
import { getNextEntryNumber, ensureAccountByCode, ensureControlAccount } from "./journal-automation";
import { bankCodingId, bankCodingSchema, bankSplitSchema, bankExpenseSchema, bankExpenseMcpSchema, bankBulkSchema, bankCashSchema,
  bankAllocationAmount, bankExpenseAmount } from "./bank-categorization-wire";
import { expenseHeaderDto, type ExpenseTransport } from "./expense-wire";
import { expenseTaxSplit } from "./expense-lifecycle-wire";
import { convertInvoiceLegs } from "./invoice-lifecycle-wire";
import { invoiceRound } from "./invoice-write-wire";
import { sameBankReadCurrency, bankReadCurrency } from "./bank-transaction-read-wire";
import { legacyMinor, stringifyWire, WireCompatibilityError } from "@/lib/money/wire";
import { createHistoricalRateResolver } from "@/lib/currency/historical-rate";
import { exactRate, toLegacyRate } from "@/lib/currency/exact-rate";
import { rateDateSchema } from "@/lib/currency/rate-policy";
import { MissingExchangeRateError } from "@/lib/currency/converter";
import type { z } from "zod";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Coding = z.infer<typeof bankCodingSchema>;
type Allocation = Coding & { amount: number };
type Row = typeof bankTransaction.$inferSelect;
type Tax = typeof taxRate.$inferSelect;
type Leg = { accountId: string; debitAmount: number; creditAmount: number; description: string; costCenterId?: string | null; projectId?: string | null };
function fail(message: string): never { throw new AuthError(message, 400); }
function unsupported(message: string): never { throw new WireCompatibilityError(message); }
async function load(tx: Tx, ctx: AuthContext, id: string) {
  const [org] = await tx.select().from(organization).where(eq(organization.id, ctx.organizationId)).for("update");
  if (!org) throw new AuthError("Organization not found", 404);
  // Scope parent before decoding any money, including unsafe foreign rows.
  const [parent] = await tx.select({ bankId: bankAccount.id }).from(bankTransaction).innerJoin(bankAccount, eq(bankTransaction.bankAccountId, bankAccount.id))
    .where(and(eq(bankTransaction.id, id), eq(bankAccount.organizationId, ctx.organizationId), isNull(bankAccount.deletedAt)));
  if (!parent) throw new AuthError("Bank transaction not found", 404);
  const [bank] = await tx.select().from(bankAccount).where(and(eq(bankAccount.id, parent.bankId), eq(bankAccount.organizationId, ctx.organizationId), isNull(bankAccount.deletedAt))).for("update");
  if (!bank) throw new AuthError("Bank transaction not found", 404);
  const [row] = await tx.select().from(bankTransaction).where(and(eq(bankTransaction.id, id), eq(bankTransaction.bankAccountId, bank.id))).for("update");
  if (!row) throw new AuthError("Bank transaction not found", 404);
  const base = bankReadCurrency(org.defaultCurrency), currency = sameBankReadCurrency(row.currencyCode, bank.currencyCode);
  rateDateSchema.parse(row.date); await assertNotLocked(ctx.organizationId, row.date, ctx);
  if (row.amount === 0) fail("Cannot code a zero-amount transaction");
  if (row.status === "excluded") fail("Restore the excluded transaction before coding");
  if (row.transferTransactionId || row.transferGroupId || row.reconciliationId || row.sourceType === "transfer") fail("Undo transfer or statement reconciliation first");
  const [linkedPayment] = await tx.select({ id: payment.id }).from(payment).where(and(eq(payment.bankTransactionId, id), isNull(payment.deletedAt)));
  if (linkedPayment) fail("Undo invoice or bill matching first");
  const [expenseHistory] = await tx.select({ id: expenseClaim.id }).from(auditLog)
    .innerJoin(expenseClaim, eq(auditLog.entityId, expenseClaim.id))
    .where(and(eq(auditLog.organizationId, ctx.organizationId), eq(auditLog.entityType, "expense"),
      eq(expenseClaim.organizationId, ctx.organizationId), isNull(expenseClaim.deletedAt),
      sql`${auditLog.changes}->>'bankTransactionId' = ${id}`));
  if (expenseHistory) fail("This bank movement already created an expense; its linked expense must be resolved before coding again");
  return { bank, row, base, currency };
}
async function account(tx: Tx, ctx: AuthContext, id: string, currency: string, base: string, expense = false) {
  const [row] = await tx.select().from(chartAccount).where(and(eq(chartAccount.id, id), eq(chartAccount.organizationId, ctx.organizationId))).for("share");
  if (!row) throw new AuthError("Account not found", 404);
  if (row.deletedAt || !row.isActive || (expense && row.type !== "expense")) fail("Account must be live, active and applicable to this operation");
  if (![currency, base].includes(row.currencyCode)) unsupported("Account denomination must equal bank or base currency");
  return row;
}
async function references(tx: Tx, ctx: AuthContext, item: Omit<Coding, "accountId">, moneyIn: boolean) {
  if (item.contactId) {
    const [row] = await tx.select({ id: contact.id }).from(contact).where(and(eq(contact.id, item.contactId), eq(contact.organizationId, ctx.organizationId), isNull(contact.deletedAt))).for("share");
    if (!row) throw new AuthError("Contact not found", 404);
  }
  if (item.costCenterId) {
    const [row] = await tx.select({ id: costCenter.id }).from(costCenter).where(and(eq(costCenter.id, item.costCenterId), eq(costCenter.organizationId, ctx.organizationId), isNull(costCenter.deletedAt), eq(costCenter.isActive, true))).for("share");
    if (!row) throw new AuthError("Cost center not found", 404);
  }
  if (item.projectId) {
    const [row] = await tx.select({ id: project.id }).from(project).where(and(eq(project.id, item.projectId), eq(project.organizationId, ctx.organizationId), isNull(project.deletedAt))).for("share");
    if (!row) throw new AuthError("Project not found", 404);
  }
  if (!item.taxRateId) return null;
  const [tax] = await tx.select().from(taxRate).where(and(eq(taxRate.id, item.taxRateId), eq(taxRate.organizationId, ctx.organizationId))).for("share");
  if (!tax) throw new AuthError("Tax rate not found", 404);
  if (tax.deletedAt || !tax.isActive || tax.type === (moneyIn ? "purchase" : "sales")) fail("Tax rate must be active and applicable to the transaction direction");
  if (!Number.isInteger(tax.rate) || tax.rate < 0 || tax.rate > 2147483647 || !Number.isInteger(tax.recoverablePercent) || tax.recoverablePercent < 0 || tax.recoverablePercent > 10000 ||
    !["standard", "partial_block", "blocked", "exempt", "no_vat", "reverse_charge", "sales_tax_us"].includes(tax.kind)) unsupported("Unsupported saved tax metadata");
  const [component] = await tx.select({ id: taxComponent.id }).from(taxComponent).where(eq(taxComponent.taxRateId, tax.id));
  if (component) unsupported("Compound tax components are unsupported for bank coding");
  return tax;
}
async function fx(tx: Tx, ctx: AuthContext, row: Row, currency: string, base: string, correction: boolean) {
  if (correction) {
    if (!row.journalEntryId) unsupported("Correction requires its original categorization journal");
    const [entry] = await tx.select().from(journalEntry).where(and(eq(journalEntry.id, row.journalEntryId), eq(journalEntry.organizationId, ctx.organizationId))).for("update");
    if (!entry || entry.deletedAt || entry.status !== "posted" || entry.reversedByEntryId || entry.date !== row.date ||
      !["bank_categorization", "bank_categorization_split"].includes(entry.sourceType ?? "")) fail("Only an unreversed plain categorization can be corrected");
    const [claim] = await tx.select({ id: expenseClaim.id }).from(expenseClaim).where(eq(expenseClaim.journalEntryId, entry.id));
    if (claim || entry.sourceId && entry.sourceId !== row.id) fail("A bank-created expense must be undone before correction");
    const lines = await tx.select().from(journalLine).where(eq(journalLine.journalEntryId, entry.id));
    if (!lines.length) unsupported("Original categorization lacks journal lines");
    const rate = lines[0].rateExact;
    let numericRate: number;
    try { if (!rate) throw new Error(); numericRate = toLegacyRate(rate); }
    catch { unsupported("Original categorization lacks supported saved exact FX"); }
    if (lines.some(l => l.currencyCode !== currency || l.rateExact !== rate || l.exchangeRate !== numericRate || l.rateDirection !== "quote_per_base" || l.rateMigrationStatus !== "exact")) unsupported("Original categorization lacks consistent saved exact FX");
    if (row.accountId) await account(tx, ctx, row.accountId, currency, base);
    const bank = await tx.query.bankAccount.findFirst({ where: and(eq(bankAccount.id, row.bankAccountId), eq(bankAccount.organizationId, ctx.organizationId)) });
    const magnitude = legacyMinor(row.amount < 0 ? -BigInt(row.amount) : BigInt(row.amount));
    const expected = convertInvoiceLegs([{ debitAmount: magnitude, creditAmount: 0 }, { debitAmount: 0, creditAmount: magnitude }], currency, base, rate!)[0].debitAmount;
    const bankLines = lines.filter(l => l.accountId === bank?.chartAccountId);
    if (bankLines.length !== 1 || bankLines[0].debitAmount !== (row.amount > 0 ? expected : 0) || bankLines[0].creditAmount !== (row.amount < 0 ? expected : 0)) unsupported("Original categorization bank leg disagrees with the movement");
    const audits = await tx.select({ changes: auditLog.changes }).from(auditLog).where(and(eq(auditLog.organizationId, ctx.organizationId), eq(auditLog.entityType, "bank_transaction"), eq(auditLog.entityId, row.id)));
    const record = audits.map(a => a.changes as { journalEntryId?: string; baseCurrencyCode?: string }).find(a => a.journalEntryId === entry.id && a.baseCurrencyCode);
    if (record ? record.baseCurrencyCode !== base : currency !== base || exactRate(rate!) !== "1") unsupported("Original categorization base currency cannot be established or has changed");
    const d = lines.reduce((s,l) => s + BigInt(l.debitAmount), 0n), c = lines.reduce((s,l) => s + BigInt(l.creditAmount), 0n);
    legacyMinor(d); legacyMinor(c);
    if (d <= 0n || d !== c || lines.some(l => l.debitAmount < 0 || l.creditAmount < 0 || (l.debitAmount && l.creditAmount))) unsupported("Original categorization journal is invalid");
    for (const line of lines) {
      await account(tx, ctx, line.accountId, currency, base);
      await references(tx, ctx, line, row.amount > 0);
    }
    await references(tx, ctx, row, row.amount > 0);
    return { rateExact: rate!, previous: entry.id };
  }
  if (row.journalEntryId || row.status !== "unreconciled") fail("Transaction already reconciled or linked to a journal");
  const rate = await createHistoricalRateResolver(ctx.organizationId, tx)(currency, base, row.date);
  if (!rate) throw new MissingExchangeRateError(currency, base, row.date);
  try { toLegacyRate(rate.rateExact); } catch { unsupported("Bank FX must fit positive int32 millionths exactly"); }
  return { rateExact: rate.rateExact, previous: null };
}
async function control(tx: Tx, ctx: AuthContext, key: "inputVat" | "outputVat" | "salesTaxPayable", base: string) {
  const row = await ensureControlAccount(ctx.organizationId, key, base, tx);
  if (!row) unsupported("Missing bank tax control account");
  const checked = await account(tx, ctx, row.id, base, base);
  if (checked.type !== (key === "inputVat" ? "asset" : "liability")) unsupported("Invalid tax control account type");
  return row.id;
}
async function post(tx: Tx, ctx: AuthContext, state: Awaited<ReturnType<typeof load>>, allocations: Allocation[], taxes: (Tax | null)[], rate: string, sourceType: string, sourceId: string) {
  const { row, bank, currency, base } = state;
  const bankId = await ensureBankLedgerAccount(ctx.organizationId, bank, tx);
  const bankGl = await account(tx, ctx, bankId, currency, base);
  if (bankGl.type !== bandFor(bank.accountType).type || bankGl.currencyCode !== currency) unsupported("Bank ledger link has an incompatible type or currency");
  const links = await tx.select({ id: bankAccount.id }).from(bankAccount).where(and(eq(bankAccount.organizationId, ctx.organizationId), eq(bankAccount.chartAccountId, bankId)));
  if (links.length !== 1) unsupported("Bank ledger link is shared");
  const moneyIn = row.amount > 0, abs = legacyMinor(BigInt(row.amount) < 0n ? -BigInt(row.amount) : BigInt(row.amount));
  const legs: Leg[] = [{ accountId: bankId, debitAmount: moneyIn ? abs : 0, creditAmount: moneyIn ? 0 : abs, description: row.description }];
  for (let i = 0; i < allocations.length; i++) {
    const item = allocations[i], tax = taxes[i], description = item.memo?.trim() || row.description;
    if (item.accountId === bankId) fail("Chosen category cannot equal the bank ledger account");
    if (moneyIn) {
      const taxAmount = tax && tax.rate && !["exempt", "no_vat", "reverse_charge"].includes(tax.kind)
        ? legacyMinor(invoiceRound(BigInt(item.amount) * BigInt(tax.rate), 10000n + BigInt(tax.rate))) : 0;
      legs.push({ accountId: item.accountId, debitAmount: 0, creditAmount: legacyMinor(BigInt(item.amount) - BigInt(taxAmount)), description,
        costCenterId: item.costCenterId ?? null, projectId: item.projectId ?? null });
      if (taxAmount) legs.push({ accountId: await control(tx, ctx, tax!.kind === "sales_tax_us" ? "salesTaxPayable" : "outputVat", base), debitAmount: 0, creditAmount: taxAmount, description });
    } else {
      const split = expenseTaxSplit(item.amount, tax);
      legs.push({ accountId: item.accountId, debitAmount: split.expense, creditAmount: 0, description,
        costCenterId: item.costCenterId ?? null, projectId: item.projectId ?? null });
      if (split.input) legs.push({ accountId: await control(tx, ctx, "inputVat", base), debitAmount: split.input, creditAmount: 0, description });
      if (split.output) legs.push({ accountId: await control(tx, ctx, "outputVat", base), debitAmount: 0, creditAmount: split.output, description });
    }
  }
  const converted = convertInvoiceLegs(legs, currency, base, rate);
  const total = converted.reduce((s,l) => s + BigInt(l.debitAmount), 0n);
  if (total <= 0n || converted[0].debitAmount + converted[0].creditAmount <= 0 || converted.some(l => l.debitAmount < 0 || l.creditAmount < 0 || (l.debitAmount && l.creditAmount))) unsupported("Converted bank journal has invalid or zero base amounts");
  const entryNumber = await getNextEntryNumber(ctx.organizationId, tx);
  if (!Number.isInteger(entryNumber) || entryNumber < 1 || entryNumber > 2147483647) unsupported("Journal numbering exceeds int32 capacity");
  const [entry] = await tx.insert(journalEntry).values({ organizationId: ctx.organizationId, entryNumber, date: row.date, description: allocations[0].memo?.trim() || row.description,
    reference: row.reference || row.description, sourceType, sourceId, status: "posted", postedAt: new Date(), createdBy: ctx.userId }).returning();
  await tx.insert(journalLine).values(converted.map(l => ({ ...l, journalEntryId: entry.id, currencyCode: currency, exchangeRate: toLegacyRate(rate),
    rateExact: rate, rateDirection: "quote_per_base", rateFormatVersion: 1, rateMigrationStatus: "exact", rateProvenance: "bank_categorization:transaction" })));
  return entry;
}
async function audit(tx: Tx, ctx: AuthContext, id: string, action: string, changes: unknown, request?: Request) {
  await tx.insert(auditLog).values({ organizationId: ctx.organizationId, userId: ctx.userId, entityType: "bank_transaction", entityId: id, action,
    changes: JSON.parse(stringifyWire(changes)), ipAddress: request?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null, userAgent: request?.headers.get("user-agent") || null });
}
export async function categorizeBankTransaction(ctx: AuthContext, id: string, input: unknown, request?: Request, allowCorrection = true, transaction?: Tx) {
  requireRole(ctx, "manage:banking"); bankCodingId.parse(id); const parsed = bankCodingSchema.parse(input);
  const run = async (tx: Tx) => {
    const state = await load(tx, ctx, id), { row, currency, base } = state;
    const correction = allowCorrection && row.status === "reconciled";
    const rate = await fx(tx, ctx, row, currency, base, correction);
    await account(tx, ctx, parsed.accountId, currency, base);
    const tax = await references(tx, ctx, parsed, row.amount > 0);
    const allocation = { ...parsed, amount: legacyMinor(row.amount < 0 ? -BigInt(row.amount) : BigInt(row.amount)) };
    const entry = await post(tx, ctx, state, [allocation], [tax], rate.rateExact, "bank_categorization", id);
    if (rate.previous) await tx.update(journalEntry).set({ status: "void", voidedAt: new Date(), voidReason: "Re-categorized", deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(journalEntry.id, rate.previous), eq(journalEntry.organizationId, ctx.organizationId)));
    await tx.update(bankTransaction).set({ status: "reconciled", accountId: parsed.accountId, contactId: parsed.contactId ?? null, taxRateId: parsed.taxRateId ?? null,
      costCenterId: parsed.costCenterId ?? null, projectId: parsed.projectId ?? null, journalEntryId: entry.id }).where(eq(bankTransaction.id, id));
    const result = { journalEntryId: entry.id }; stringifyWire(result);
    await audit(tx, ctx, id, correction ? "recategorized" : "categorized", { ...result, previousJournalEntryId: rate.previous,
      amount: row.amount, amountMinor: String(row.amount), baseCurrencyCode: base, currencyCode: currency, rateExact: rate.rateExact, allocations: [allocation] }, request);
    return result;
  };
  return transaction ? run(transaction) : db.transaction(run);
}
export async function splitBankAccounts(ctx: AuthContext, id: string, input: unknown, request?: Request, transaction?: Tx) {
  requireRole(ctx, "manage:banking"); bankCodingId.parse(id); const parsed = bankSplitSchema.parse(input);
  const allocations = parsed.allocations.map(a => ({ ...a, amount: bankAllocationAmount(a) }));
  const run = async (tx: Tx) => {
    const state = await load(tx, ctx, id), { row, base, currency } = state;
    const sum = allocations.reduce((s,a) => s + BigInt(a.amount), 0n); legacyMinor(sum);
    if (sum !== (row.amount < 0 ? -BigInt(row.amount) : BigInt(row.amount))) fail("Allocations must sum exactly to the absolute bank amount in minor units");
    const rate = await fx(tx, ctx, row, currency, base, false), taxes = [];
    for (const item of allocations) { await account(tx, ctx, item.accountId, currency, base); taxes.push(await references(tx, ctx, item, row.amount > 0)); }
    const entry = await post(tx, ctx, state, allocations, taxes, rate.rateExact, "bank_categorization_split", id);
    await tx.update(bankTransaction).set({ status: "reconciled", accountId: null, taxRateId: null, contactId: null, costCenterId: null, projectId: null, journalEntryId: entry.id }).where(eq(bankTransaction.id, id));
    const result = { journalEntryId: entry.id }; stringifyWire(result);
    await audit(tx, ctx, id, "split_categorized", { ...result, amount: row.amount, amountMinor: String(row.amount), currencyCode: currency,
      baseCurrencyCode: base, rateExact: rate.rateExact, allocations: allocations.map(a => ({ ...a, amountMinor: String(a.amount) })) }, request);
    return result;
  };
  return transaction ? run(transaction) : db.transaction(run);
}
export async function createBankExpense(ctx: AuthContext, id: string, input: unknown, request?: Request, transport: ExpenseTransport = "rest") {
  requireRole(ctx, "manage:expenses"); bankCodingId.parse(id); const parsed = (transport === "mcp" ? bankExpenseMcpSchema : bankExpenseSchema).parse(input);
  return db.transaction(async tx => {
    const state = await load(tx, ctx, id), { row, base, currency } = state;
    if (row.amount >= 0) fail("Expense creation requires an outgoing bank transaction");
    if (parsed.currencyCode && parsed.currencyCode !== currency) fail("Expense currency must equal bank currency");
    const amounts = parsed.items.map(i => bankExpenseAmount(i, currency, transport));
    const total = legacyMinor(amounts.reduce((s,a) => s + BigInt(a), 0n));
    if (BigInt(total) !== -BigInt(row.amount)) fail("Expense total must equal the outgoing bank magnitude");
    for (const item of parsed.items) await assertNotLocked(ctx.organizationId, item.date, ctx);
    const rate = await fx(tx, ctx, row, currency, base, false);
    const tax = await references(tx, ctx, parsed, false);
    for (const item of parsed.items) if (item.accountId) await account(tx, ctx, item.accountId, currency, base, true);
    const fallback = parsed.items.some(i => !i.accountId) ? await ensureAccountByCode(ctx.organizationId,
      { code: "5990", name: "Miscellaneous Expense", type: "expense", subType: "operating" }, base, tx) : null;
    if (fallback) await account(tx, ctx, fallback.id, currency, base, true);
    const allocations = parsed.items.flatMap((item, i) => amounts[i] ? [{ ...parsed, accountId: item.accountId ?? fallback!.id, amount: amounts[i], memo: item.description }] : []);
    const [claim] = await tx.insert(expenseClaim).values({ organizationId: ctx.organizationId, submittedBy: ctx.userId, approvedBy: ctx.userId,
      title: parsed.title, description: parsed.description ?? null, currencyCode: currency, totalAmount: total,
      status: "paid", submittedAt: new Date(), approvedAt: new Date(), paidAt: new Date() }).returning();
    await tx.insert(expenseItem).values(parsed.items.map((item,i) => ({ expenseClaimId: claim.id, date: item.date, description: item.description, category: item.category ?? null,
      accountId: item.accountId ?? fallback?.id ?? null, amount: amounts[i], taxRateId: parsed.taxRateId ?? null, costCenterId: parsed.costCenterId ?? null, sortOrder: i })));
    const entry = await post(tx, ctx, state, allocations, allocations.map(() => tax), rate.rateExact, "bank_expense", claim.id);
    const [saved] = await tx.update(expenseClaim).set({ journalEntryId: entry.id }).where(eq(expenseClaim.id, claim.id)).returning();
    const accountIds = new Set(allocations.map(a => a.accountId));
    await tx.update(bankTransaction).set({ status: "reconciled", journalEntryId: entry.id, accountId: accountIds.size === 1 ? allocations[0].accountId : null,
      contactId: parsed.contactId ?? null, taxRateId: parsed.taxRateId ?? null, costCenterId: parsed.costCenterId ?? null, projectId: parsed.projectId ?? null }).where(eq(bankTransaction.id, id));
    const result = { expenseClaim: expenseHeaderDto(saved), journalEntryId: entry.id }; stringifyWire(result);
    const changes = { expenseClaimId: claim.id, journalEntryId: entry.id, amount: total, amountMinor: String(total), currencyCode: currency, baseCurrencyCode: base,
      rateExact: rate.rateExact, allocations: allocations.map(a => ({ accountId: a.accountId, amount: a.amount, amountMinor: String(a.amount) })) };
    await audit(tx, ctx, id, "expense_created", changes, request);
    await tx.insert(auditLog).values({ organizationId: ctx.organizationId, userId: ctx.userId, entityType: "expense", entityId: claim.id, action: "create",
      changes: { ...changes, bankTransactionId: id, status: "paid" } });
    return result;
  });
}
export async function bulkCategorizeBankTransactions(ctx: AuthContext, input: unknown, request?: Request) {
  requireRole(ctx, "manage:banking"); const { items } = bankBulkSchema.parse(input);
  const results = [];
  for (const { transactionId, ...coding } of items) {
    try { results.push({ transactionId, success: true, ...await categorizeBankTransaction(ctx, transactionId, coding, request, false) }); }
    catch (error) { results.push({ transactionId, success: false, error: error instanceof AuthError || error instanceof WireCompatibilityError || error instanceof MissingExchangeRateError || (error instanceof Error && error.name === "PeriodLockedError") ? error.message : "Failed to categorize transaction" }); }
  }
  const succeeded = results.filter(r => r.success).length;
  return { results, summary: { total: results.length, succeeded, failed: results.length - succeeded } };
}
export async function bulkBankCashCode(ctx: AuthContext, input: unknown) {
  requireRole(ctx, "manage:banking"); const { transactionIds, ...coding } = bankCashSchema.parse(input);
  const response = await bulkCategorizeBankTransactions(ctx, { items: transactionIds.map(transactionId => ({ transactionId, ...coding })) });
  return { accountId: coding.accountId, requested: response.summary.total, succeeded: response.summary.succeeded, failed: response.summary.failed,
    results: response.results.map(({ success, ...result }) => ({ ...result, ok: success })) };
}
