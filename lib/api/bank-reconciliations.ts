import { and, asc, desc, eq, gte, inArray, isNull, lte, ne, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { organization, bankAccount, bankTransaction, bankReconciliation, bankStatementImport, chartAccount, journalEntry, journalLine,
  auditLog, payment, paymentAllocation, invoice, bill, expenseClaim, expenseItem, contact, taxRate, costCenter, project, customerCredit } from "@/lib/db/schema";
import { AuthError, type AuthContext } from "./auth-context";
import { requireRole } from "./require-role";
import { assertNotLocked } from "./period-lock";
import { bankReadSnapshot, checkPlainReferences } from "./bank-transaction-reads";
import { bankReadId, bankReadCurrency, bankReadNullableMoney, sameBankReadCurrency, bankReadPagination, bankReadCount } from "./bank-transaction-read-wire";
import { reconciliationCreateSchema, reconciliationCompleteSchema, reconciliationAdjustmentSchema, reconciliationMarkSchema,
  reconciliationAmount, reconciliationDto } from "./bank-reconciliation-wire";
import { bankAccountDto } from "./bank-account-wire";
import { publicMoneyDto } from "./public-money-wire";
import { journalLineDto } from "./journal-wire";
import { paymentCashBase } from "./payment-settlement-wire";
import { reversePaymentInTransaction } from "./payment-reversals";
import { rateDateSchema } from "@/lib/currency/rate-policy";
import { toLegacyRate } from "@/lib/currency/exact-rate";
import { legacyMinor, stringifyWire, WireCompatibilityError } from "@/lib/money/wire";
import { getNextEntryNumber, ensureAccountByCode } from "./journal-automation";
import { ensureBankLedgerAccount } from "./bank-ledger";
import { bandFor } from "./bank-ledger-codes";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Bank = typeof bankAccount.$inferSelect;
type Movement = typeof bankTransaction.$inferSelect;
function fail(message: string): never { throw new AuthError(message, 400); }
function unsupported(message: string): never { throw new WireCompatibilityError(message); }
async function lockOrg(tx: Tx, ctx: AuthContext) {
  const [org] = await tx.select().from(organization).where(eq(organization.id, ctx.organizationId)).for("update");
  if (!org) throw new AuthError("Organization not found", 404);
  return bankReadCurrency(org.defaultCurrency);
}
async function loadBank(tx: Tx, ctx: AuthContext, id: string, write = false) {
  bankReadId.parse(id);
  const query = tx.select().from(bankAccount).where(and(eq(bankAccount.id, id), eq(bankAccount.organizationId, ctx.organizationId), isNull(bankAccount.deletedAt)));
  const [bank] = await (write ? query.for("update") : query);
  if (!bank) throw new AuthError("Bank account not found", 404);
  bankAccountDto(bank); bankReadCurrency(bank.currencyCode);
  if (write && !bank.isActive) fail("Reconciliation requires an active bank account");
  return bank;
}
async function session(tx: Tx, bank: Bank, id: string, write = false) {
  bankReadId.parse(id);
  const query = tx.select().from(bankReconciliation).where(and(eq(bankReconciliation.id, id), eq(bankReconciliation.bankAccountId, bank.id)));
  const [rec] = await (write ? query.for("update") : query);
  if (!rec) throw new AuthError("Reconciliation not found", 404);
  reconciliationDto(rec);
  const [foreign] = await tx.select({ id: bankTransaction.id }).from(bankTransaction).where(and(eq(bankTransaction.reconciliationId, rec.id), ne(bankTransaction.bankAccountId, bank.id))).limit(1);
  if (foreign) unsupported("Reconciliation contains another bank's statements");
  return rec;
}
async function openSession(tx: Tx, ctx: AuthContext, bank: Bank, id: string, date?: string) {
  const rec = await session(tx, bank, id, true);
  if (rec.status !== "in_progress") fail("Reconciliation is already completed");
  if (date && (date < rec.startDate || date > rec.endDate)) fail("Transaction date is outside the statement window");
  await assertNotLocked(ctx.organizationId, rec.startDate, ctx); await assertNotLocked(ctx.organizationId, rec.endDate, ctx);
  return rec;
}
async function movementDto(tx: Tx, ctx: AuthContext, bank: Bank, row: Movement) {
  const result = { ...bankReadNullableMoney(row, ["amount", "balance"]), amountMinor: String(row.amount), balanceMinor: row.balance === null ? null : String(row.balance), currencyCode: sameBankReadCurrency(row.currencyCode, bank.currencyCode) };
  rateDateSchema.parse(row.date); await checkPlainReferences(tx, ctx, row);
  for (const [id, table] of [[row.accountId, chartAccount], [row.contactId, contact], [row.taxRateId, taxRate], [row.journalEntryId, journalEntry]] as const) {
    if (!id) continue;
    const [ref] = await tx.select({ id: table.id }).from(table).where(and(eq(table.id, id), eq(table.organizationId, ctx.organizationId)));
    if (!ref) unsupported("Statement has an unavailable or foreign reference");
  }
  if (row.reconciliationId) await session(tx, bank, row.reconciliationId);
  if (row.importId) {
    const [imp] = await tx.select().from(bankStatementImport).where(and(eq(bankStatementImport.id, row.importId), eq(bankStatementImport.organizationId, ctx.organizationId), eq(bankStatementImport.bankAccountId, bank.id)));
    if (!imp) unsupported("Statement import belongs to another organization or bank");
    bankReadNullableMoney(imp, ["openingBalance", "closingBalance"]); sameBankReadCurrency(imp.statementCurrency, bank.currencyCode);
  }
  stringifyWire(result); return result;
}
async function loadMovement(tx: Tx, ctx: AuthContext, id: string) {
  bankReadId.parse(id);
  const [parent] = await tx.select({ id: bankAccount.id }).from(bankTransaction).innerJoin(bankAccount, eq(bankAccount.id, bankTransaction.bankAccountId))
    .where(and(eq(bankTransaction.id, id), eq(bankAccount.organizationId, ctx.organizationId), isNull(bankAccount.deletedAt)));
  if (!parent) throw new AuthError("Bank transaction not found", 404);
  const bank = await loadBank(tx, ctx, parent.id, true);
  const [row] = await tx.select().from(bankTransaction).where(and(eq(bankTransaction.id, id), eq(bankTransaction.bankAccountId, bank.id))).for("update");
  if (!row) throw new AuthError("Bank transaction not found", 404);
  await movementDto(tx, ctx, bank, row); await assertNotLocked(ctx.organizationId, row.date, ctx);
  return { bank, row };
}
async function bankGl(tx: Tx, ctx: AuthContext, bank: Bank, create = false) {
  const id = create ? await ensureBankLedgerAccount(ctx.organizationId, bank, tx) : bank.chartAccountId;
  if (!id) return null;
  const [gl] = await tx.select().from(chartAccount).where(and(eq(chartAccount.id, id), eq(chartAccount.organizationId, ctx.organizationId)));
  const [other] = await tx.select({ id: bankAccount.id }).from(bankAccount).where(and(eq(bankAccount.chartAccountId, id), ne(bankAccount.id, bank.id)));
  if (!gl || other || gl.deletedAt || !gl.isActive || gl.currencyCode !== bank.currencyCode || gl.type !== bandFor(bank.accountType).type)
    unsupported("Bank GL must be active, exclusively linked and correctly denominated");
  return gl;
}
async function audit(tx: Tx, ctx: AuthContext, entityType: string, id: string, action: string, changes: unknown, request?: Request) {
  await tx.insert(auditLog).values({ organizationId: ctx.organizationId, userId: ctx.userId, entityType, entityId: id, action,
    changes: JSON.parse(stringifyWire(changes)), ipAddress: request?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null, userAgent: request?.headers.get("user-agent") || null });
}
async function baseCurrency(tx: Tx, ctx: AuthContext) {
  const [org] = await tx.select({ currency: organization.defaultCurrency }).from(organization).where(eq(organization.id, ctx.organizationId));
  if (!org) throw new AuthError("Organization not found", 404);
  return bankReadCurrency(org.currency);
}
async function proof(tx: Tx, ctx: AuthContext, bank: Bank, recId?: string) {
  const base = await baseCurrency(tx, ctx);
  const [latest] = recId ? [] : await tx.select().from(bankReconciliation).where(eq(bankReconciliation.bankAccountId, bank.id)).orderBy(desc(bankReconciliation.createdAt), asc(bankReconciliation.id)).limit(1);
  const rec = recId || latest ? await session(tx, bank, recId ?? latest.id) : null;
  const reconciled = await tx.select().from(bankTransaction).where(and(eq(bankTransaction.bankAccountId, bank.id),
    rec ? eq(bankTransaction.reconciliationId, rec.id) : sql`${bankTransaction.reconciliationId} is not null`)).orderBy(asc(bankTransaction.date), asc(bankTransaction.id));
  const pending = await tx.select().from(bankTransaction).where(and(eq(bankTransaction.bankAccountId, bank.id), isNull(bankTransaction.reconciliationId), ne(bankTransaction.status, "excluded"),
    rec ? gte(bankTransaction.date, rec.startDate) : undefined, rec ? lte(bankTransaction.date, rec.endDate) : undefined)).orderBy(asc(bankTransaction.date), asc(bankTransaction.id));
  const group = async (rows: Movement[]) => ({ count: rows.length, ...publicMoneyDto({ total: legacyMinor(rows.reduce((s,r) => s + BigInt(publicMoneyDto(r, ["amount"]).amountMinor), 0n)) }, ["total"]),
    transactions: await Promise.all(rows.map(row => movementDto(tx, ctx, bank, row))) });
  const gl = await bankGl(tx, ctx, bank);
  // PostgreSQL numeric SUM -> text -> bigint: never cast money to int32/Number.
  let glBalance: number | null = null;
  if (gl) {
    const [foreign] = await tx.select({ id: journalLine.id }).from(journalLine).innerJoin(journalEntry, eq(journalEntry.id, journalLine.journalEntryId))
      .where(and(eq(journalLine.accountId, gl.id), ne(journalEntry.organizationId, ctx.organizationId))).limit(1);
    if (foreign) unsupported("Bank GL is referenced by another organization's journal");
    const [sum] = await tx.select({ value: sql<string>`coalesce(sum(${journalLine.debitAmount}::numeric - ${journalLine.creditAmount}::numeric),0)::text`,
      invalid: sql<boolean>`coalesce(bool_or(${journalLine.debitAmount} < 0 or ${journalLine.creditAmount} < 0 or (${journalLine.debitAmount} <> 0 and ${journalLine.creditAmount} <> 0) or abs(${journalLine.debitAmount}::numeric) > 9007199254740991 or abs(${journalLine.creditAmount}::numeric) > 9007199254740991),false)` })
      .from(journalLine).innerJoin(journalEntry, eq(journalEntry.id, journalLine.journalEntryId))
      .where(and(eq(journalLine.accountId, gl.id), eq(journalEntry.organizationId, ctx.organizationId), eq(journalEntry.status, "posted"), isNull(journalEntry.deletedAt), rec ? lte(journalEntry.date, rec.endDate) : undefined));
    if (sum.invalid) unsupported("Bank GL contains invalid or unsafe saved money");
    glBalance = legacyMinor(BigInt(sum.value));
  }
  const statementEndBalance = rec?.endBalance ?? bank.balance;
  // Foreign statement money cannot be subtracted from base-currency GL money.
  const difference = glBalance === null || bank.currencyCode !== base ? null : legacyMinor(BigInt(statementEndBalance) - BigInt(glBalance));
  const result = { bankAccountId: bank.id, currencyCode: bank.currencyCode, glCurrencyCode: base,
    reconciliation: rec ? reconciliationDto(rec) : null, ...bankReadNullableMoney({ statementEndBalance, glBalance, difference }, ["statementEndBalance", "glBalance", "difference"]),
    comparisonUnavailableReason: !gl ? "missing_ledger_account" : bank.currencyCode !== base ? "different_currency_units" : null,
    isBalanced: difference === 0, hasLedgerAccount: gl !== null, reconciled: await group(reconciled), unreconciled: await group(pending) };
  stringifyWire(result); return result;
}
export async function getBankReconciliationProof(ctx: AuthContext, id: string, recId?: string) {
  requireRole(ctx, "manage:banking"); if (recId) bankReadId.parse(recId);
  return bankReadSnapshot(async tx => proof(tx, ctx, await loadBank(tx, ctx, id), recId));
}
export async function listBankReconciliations(ctx: AuthContext, input: unknown) {
  const params = bankReadPagination(input);
  return bankReadSnapshot(async tx => {
    const bank = await loadBank(tx, ctx, params.bankAccountId);
    const rows = await tx.select().from(bankReconciliation).where(eq(bankReconciliation.bankAccountId, bank.id)).orderBy(desc(bankReconciliation.createdAt), asc(bankReconciliation.id)).limit(params.limit).offset(params.offset);
    const reconciliations = [];
    for (const row of rows) {
      const [count] = await tx.select({ value: sql<string>`count(*)::text`, foreign: sql<boolean>`coalesce(bool_or(${bankTransaction.bankAccountId} <> ${bank.id}),false)` }).from(bankTransaction).where(eq(bankTransaction.reconciliationId, row.id));
      if (count.foreign) unsupported("Reconciliation contains foreign bank statements");
      reconciliations.push({ ...reconciliationDto(row), currencyCode: bank.currencyCode, transactionCount: bankReadCount(count.value) });
    }
    const [count] = await tx.select({ value: sql<string>`count(*)::text` }).from(bankReconciliation).where(eq(bankReconciliation.bankAccountId, bank.id));
    return { reconciliations, total: bankReadCount(count.value), page: params.page, limit: params.limit };
  });
}
export async function createBankReconciliation(ctx: AuthContext, id: string, input: unknown, request?: Request) {
  requireRole(ctx, "manage:banking"); bankReadId.parse(id);
  const parsed = reconciliationCreateSchema.parse(input), startBalance = reconciliationAmount(parsed, "startBalance"), endBalance = reconciliationAmount(parsed, "endBalance");
  return db.transaction(async tx => {
    await lockOrg(tx, ctx); const bank = await loadBank(tx, ctx, id, true);
    await assertNotLocked(ctx.organizationId, parsed.startDate, ctx); await assertNotLocked(ctx.organizationId, parsed.endDate, ctx);
    const [overlap] = await tx.select({ id: bankReconciliation.id }).from(bankReconciliation).where(and(eq(bankReconciliation.bankAccountId, id), lte(bankReconciliation.startDate, parsed.endDate), gte(bankReconciliation.endDate, parsed.startDate)));
    if (overlap) fail("Statement window overlaps an existing reconciliation");
    const [rec] = await tx.insert(bankReconciliation).values({ bankAccountId: id, startDate: parsed.startDate, endDate: parsed.endDate, startBalance, endBalance }).returning();
    const result = { reconciliation: { ...reconciliationDto(rec), currencyCode: bank.currencyCode } }; stringifyWire(result);
    await audit(tx, ctx, "bank_account", id, "created_reconciliation", { ...result.reconciliation, reconciliationId: rec.id }, request); return result;
  });
}
async function savedJournal(tx: Tx, ctx: AuthContext, id: string | null) {
  const [entry] = id ? await tx.select().from(journalEntry).where(and(eq(journalEntry.id, id), eq(journalEntry.organizationId, ctx.organizationId))).for("update") : [];
  if (!entry) throw new AuthError("Journal entry not found", 404);
  if (entry.deletedAt || entry.status !== "posted" || entry.reversedByEntryId || entry.reversesEntryId) unsupported("Journal must be posted and unreversed");
  rateDateSchema.parse(entry.date); await assertNotLocked(ctx.organizationId, entry.date, ctx);
  const lines = await tx.select().from(journalLine).where(eq(journalLine.journalEntryId, entry.id)).for("update");
  let debit = 0n, credit = 0n;
  for (const line of lines) {
    journalLineDto(line); bankReadCurrency(line.currencyCode);
    if (!line.rateExact || line.rateMigrationStatus !== "exact" || line.rateDirection !== "quote_per_base" || line.rateFormatVersion !== 1 ||
      toLegacyRate(line.rateExact) !== line.exchangeRate || line.debitAmount < 0 || line.creditAmount < 0 || (line.debitAmount && line.creditAmount)) unsupported("Journal lacks qualified saved money and FX");
    for (const [id, table] of [[line.accountId, chartAccount], [line.costCenterId, costCenter], [line.projectId, project]] as const) {
      if (!id) continue;
      const [owned] = await tx.select({ id: table.id }).from(table).where(and(eq(table.id, id), eq(table.organizationId, ctx.organizationId))).for("share");
      if (!owned) unsupported("Saved journal has foreign accounts or dimensions");
    }
    debit += BigInt(line.debitAmount); credit += BigInt(line.creditAmount);
  }
  legacyMinor(debit); legacyMinor(credit);
  if (debit <= 0n || debit !== credit) unsupported("Journal must have positive balanced safe totals");
  return { entry, lines };
}
async function matchBankLeg(tx: Tx, ctx: AuthContext, bank: Bank, row: Movement, base: string, saved: Awaited<ReturnType<typeof savedJournal>>) {
  const gl = await bankGl(tx, ctx, bank);
  if (!gl) unsupported("Reconciliation requires a saved bank GL account");
  const legs = saved.lines.filter(line => line.accountId === gl.id);
  if (!legs.length || legs.some(l => l.currencyCode !== bank.currencyCode || l.rateExact !== legs[0].rateExact)) unsupported("Saved journal lacks a consistent bank leg");
  const magnitude = legacyMinor(row.amount < 0 ? -BigInt(row.amount) : BigInt(row.amount));
  const expected = paymentCashBase(magnitude, bank.currencyCode, base, legs[0].rateExact!);
  const cash = legs.reduce((s,l) => s + BigInt(l.debitAmount) - BigInt(l.creditAmount), 0n);
  if (!expected || cash !== BigInt(row.amount > 0 ? expected : -expected)) unsupported("Saved bank leg disagrees with the statement amount or direction");
}
async function histories(tx: Tx, ctx: AuthContext, id: string) {
  const rows = await tx.select().from(auditLog).where(and(eq(auditLog.organizationId, ctx.organizationId), eq(auditLog.entityType, "bank_transaction"), eq(auditLog.entityId, id))).orderBy(desc(auditLog.createdAt), desc(auditLog.id));
  return rows.map(row => ({ action: row.action, changes: row.changes as Record<string, unknown> | null }));
}
async function noHiddenHistory(tx: Tx, ctx: AuthContext, row: Movement) {
  const [linked] = await tx.select({ id: payment.id }).from(payment).where(and(eq(payment.bankTransactionId, row.id), isNull(payment.deletedAt)));
  const [claim] = await tx.select({ id: expenseClaim.id }).from(auditLog).innerJoin(expenseClaim, eq(expenseClaim.id, auditLog.entityId))
    .where(and(eq(auditLog.organizationId, ctx.organizationId), eq(auditLog.entityType, "expense"), isNull(expenseClaim.deletedAt), sql`${auditLog.changes}->>'bankTransactionId' = ${row.id}`));
  if (linked || claim) fail("Resolve linked payment or expense history first");
}
export async function reconcileBankTransaction(ctx: AuthContext, id: string, input: unknown, request?: Request) {
  requireRole(ctx, "manage:banking"); const parsed = reconciliationMarkSchema.parse(input);
  return db.transaction(async tx => {
    const base = await lockOrg(tx, ctx), { bank, row } = await loadMovement(tx, ctx, id);
    if (row.status !== "unreconciled" || !row.amount || row.reconciliationId || row.transferTransactionId || row.transferGroupId || row.sourceType === "transfer") fail("Requires an unlinked nonzero unreconciled statement");
    await noHiddenHistory(tx, ctx, row);
    const journalId = parsed.journalEntryId ?? row.journalEntryId;
    if (!journalId) fail("Reconciliation requires a matching posted journal; categorize or match first");
    if (row.journalEntryId && row.journalEntryId !== journalId) fail("Cannot replace saved journal history");
    const saved = await savedJournal(tx, ctx, journalId); await matchBankLeg(tx, ctx, bank, row, base, saved);
    if (bank.currencyCode !== base || saved.lines.some(l => l.currencyCode !== base || l.rateExact !== "1")) unsupported("Direct journal reconciliation requires base-currency identity FX");
    const links = await tx.select({ id: bankTransaction.id }).from(bankTransaction).where(and(eq(bankTransaction.journalEntryId, journalId), ne(bankTransaction.id, id)));
    const [pay] = await tx.select({ id: payment.id }).from(payment).where(eq(payment.journalEntryId, journalId));
    const [claim] = await tx.select({ id: expenseClaim.id }).from(expenseClaim).where(eq(expenseClaim.journalEntryId, journalId));
    const [credit] = await tx.select({ id: customerCredit.id }).from(customerCredit).where(eq(customerCredit.journalEntryId, journalId));
    if (links.length || pay || claim || credit || ![null, "manual"].includes(saved.entry.sourceType)) fail("Use the dedicated matching or undo workflow for linked domain history");
    if (parsed.reconciliationId) await openSession(tx, ctx, bank, parsed.reconciliationId, row.date);
    const [updated] = await tx.update(bankTransaction).set({ status: "reconciled", journalEntryId: journalId, reconciliationId: parsed.reconciliationId ?? null }).where(eq(bankTransaction.id, id)).returning();
    const result = { transaction: await movementDto(tx, ctx, bank, updated) };
    await audit(tx, ctx, "bank_transaction", id, "reconciled", { journalEntryId: journalId, reconciliationId: updated.reconciliationId, preservesExistingJournal: true }, request); return result;
  });
}
export async function completeBankReconciliation(ctx: AuthContext, id: string, input: unknown, request?: Request) {
  requireRole(ctx, "manage:banking"); const parsed = reconciliationCompleteSchema.parse(input);
  if (parsed.transactionIds && new Set(parsed.transactionIds).size !== parsed.transactionIds.length) fail("Transaction IDs must be distinct");
  return db.transaction(async tx => {
    const base = await lockOrg(tx, ctx), bank = await loadBank(tx, ctx, id, true), rec = await openSession(tx, ctx, bank, parsed.reconciliationId);
    if (bank.currencyCode !== base) unsupported("Statement completion requires bank and GL in the same currency; foreign balance qualification is separate");
    const rows = await tx.select().from(bankTransaction).where(and(eq(bankTransaction.bankAccountId, id), gte(bankTransaction.date, rec.startDate), lte(bankTransaction.date, rec.endDate), ne(bankTransaction.status, "excluded"))).for("update");
    const eligible = rows.filter(r => !r.reconciliationId), selected = parsed.transactionIds ? eligible.filter(r => parsed.transactionIds!.includes(r.id)) : eligible;
    if (parsed.transactionIds && selected.length !== parsed.transactionIds.length) fail("Every requested line must belong to this bank/window and be unattached");
    if (rows.some(r => r.reconciliationId && r.reconciliationId !== rec.id) || selected.length !== eligible.length) fail("Statement completion requires all nonexcluded lines in its window");
    for (const row of rows) {
      await movementDto(tx, ctx, bank, row); await assertNotLocked(ctx.organizationId, row.date, ctx);
      if (row.status !== "reconciled" || !row.journalEntryId) fail("Every statement line must be accounted for before completion");
      const saved = await savedJournal(tx, ctx, row.journalEntryId); await matchBankLeg(tx, ctx, bank, row, base, saved);
    }
    const statementSum = rows.reduce((s,r) => s + BigInt(r.amount), 0n); legacyMinor(statementSum);
    if (BigInt(rec.startBalance) + statementSum !== BigInt(rec.endBalance)) fail("Opening balance plus statement movements must equal closing balance");
    const report = await proof(tx, ctx, bank, rec.id);
    if (!report.isBalanced) fail("Statement closing balance must equal the bank GL before completion");
    if (selected.length) await tx.update(bankTransaction).set({ reconciliationId: rec.id }).where(inArray(bankTransaction.id, selected.map(r => r.id)));
    await tx.update(bankReconciliation).set({ status: "completed" }).where(eq(bankReconciliation.id, rec.id));
    const result = { reconciliationId: rec.id, status: "completed", reconciledCount: selected.length }; stringifyWire(result);
    await audit(tx, ctx, "bank_reconciliation", rec.id, "completed_reconciliation", { bankAccountId: id, transactionCount: selected.length, statementSumMinor: String(statementSum) }, request); return result;
  });
}
export async function postBankReconciliationAdjustment(ctx: AuthContext, id: string, input: unknown, request?: Request) {
  requireRole(ctx, "manage:banking"); const parsed = reconciliationAdjustmentSchema.parse(input), amount = reconciliationAmount(parsed, "amount");
  if (!amount) fail("Adjustment amount must be nonzero");
  return db.transaction(async tx => {
    const base = await lockOrg(tx, ctx), bank = await loadBank(tx, ctx, id, true);
    if (bank.currencyCode !== base) unsupported("Adjustments require bank and base currency to match; no mixed-unit adjustment");
    await assertNotLocked(ctx.organizationId, parsed.date, ctx);
    if (parsed.reconciliationId) await openSession(tx, ctx, bank, parsed.reconciliationId, parsed.date);
    const gl = (await bankGl(tx, ctx, bank, true))!;
    const type = amount > 0 ? "revenue" : "expense";
    const def: Parameters<typeof ensureAccountByCode>[1] = amount > 0 ? { code: "4920", name: "Bank Reconciliation Adjustments (Income)", type, subType: "non_operating" } : { code: "5940", name: "Bank Reconciliation Adjustments (Expense)", type, subType: "non_operating" };
    const defaultAccount = parsed.adjustmentAccountId ? null : await ensureAccountByCode(ctx.organizationId, def, base, tx);
    const targetId = parsed.adjustmentAccountId ?? defaultAccount?.id;
    const [target] = targetId ? await tx.select().from(chartAccount).where(and(eq(chartAccount.id, targetId), eq(chartAccount.organizationId, ctx.organizationId))).for("share") : [];
    if (!target) throw new AuthError("Adjustment account not found", 404);
    if (target.id === gl.id || target.deletedAt || !target.isActive || target.currencyCode !== base || target.type !== type) unsupported("Adjustment account must be active, correctly typed and denominated");
    const description = parsed.description?.trim() || "Bank reconciliation adjustment", abs = legacyMinor(amount < 0 ? -BigInt(amount) : BigInt(amount));
    const [entry] = await tx.insert(journalEntry).values({ organizationId: ctx.organizationId, entryNumber: await nextNumber(tx, ctx), date: parsed.date,
      description, reference: "RECON-ADJ", status: "posted", sourceType: "bank_reconciliation_adjustment", sourceId: bank.id, postedAt: new Date(), createdBy: ctx.userId }).returning();
    await tx.insert(journalLine).values([{ accountId: gl.id, debitAmount: amount > 0 ? abs : 0, creditAmount: amount < 0 ? abs : 0 },
      { accountId: target.id, debitAmount: amount < 0 ? abs : 0, creditAmount: amount > 0 ? abs : 0 }].map(l => ({ ...l, journalEntryId: entry.id, description,
      currencyCode: base, exchangeRate: 1000000, rateExact: "1", rateDirection: "quote_per_base", rateMigrationStatus: "exact", rateFormatVersion: 1, rateProvenance: "bank_reconciliation:adjustment" })));
    // Retain the existing optional synthetic adjustment movement contract.
    if (parsed.reconciliationId) await tx.insert(bankTransaction).values({ bankAccountId: id, date: parsed.date, description, reference: "RECON-ADJ", amount,
      status: "reconciled", reconciliationId: parsed.reconciliationId, journalEntryId: entry.id, accountId: target.id, sourceType: "reconciliation_adjustment", currencyCode: base });
    const result = { journalEntryId: entry.id, adjustmentAccountId: target.id, ...publicMoneyDto({ amount }, ["amount"]) }; stringifyWire(result);
    await audit(tx, ctx, "bank_account", id, "posted_reconciliation_adjustment", { ...result, reconciliationId: parsed.reconciliationId ?? null, baseCurrencyCode: base }, request); return result;
  });
}
async function nextNumber(tx: Tx, ctx: AuthContext) {
  const number = await getNextEntryNumber(ctx.organizationId, tx);
  if (!Number.isInteger(number) || number < 1 || number > 2147483647) unsupported("Journal numbering exceeds int32 capacity");
  return number;
}
async function reverseJournal(tx: Tx, ctx: AuthContext, saved: Awaited<ReturnType<typeof savedJournal>>, sourceId: string) {
  const [reversal] = await tx.insert(journalEntry).values({ organizationId: ctx.organizationId, entryNumber: await nextNumber(tx, ctx), date: saved.entry.date,
    description: `Reversal: ${saved.entry.description}`, reference: saved.entry.reference, status: "posted", sourceType: "bank_reconciliation_reversal", sourceId,
    reversesEntryId: saved.entry.id, postedAt: new Date(), createdBy: ctx.userId }).returning();
  await tx.insert(journalLine).values(saved.lines.map(l => ({ journalEntryId: reversal.id, accountId: l.accountId, description: l.description,
    debitAmount: l.creditAmount, creditAmount: l.debitAmount, currencyCode: l.currencyCode, exchangeRate: l.exchangeRate, rateExact: l.rateExact,
    rateDirection: l.rateDirection, rateFormatVersion: l.rateFormatVersion, rateMigrationStatus: l.rateMigrationStatus, rateProvenance: l.rateProvenance,
    costCenterId: l.costCenterId, projectId: l.projectId })));
  await tx.update(journalEntry).set({ reversedByEntryId: reversal.id, voidedAt: new Date(), voidReason: "Bank transaction unreconciled", updatedAt: new Date() }).where(eq(journalEntry.id, saved.entry.id));
  return reversal.id;
}
async function reopenSession(tx: Tx, ctx: AuthContext, bank: Bank, row: Movement, request?: Request) {
  if (!row.reconciliationId) return;
  const rec = await session(tx, bank, row.reconciliationId, true);
  await assertNotLocked(ctx.organizationId, rec.startDate, ctx); await assertNotLocked(ctx.organizationId, rec.endDate, ctx);
  if (rec.status === "completed") {
    await tx.update(bankReconciliation).set({ status: "in_progress" }).where(eq(bankReconciliation.id, rec.id));
    await audit(tx, ctx, "bank_reconciliation", rec.id, "reopened_reconciliation", { bankAccountId: bank.id, transactionId: row.id }, request);
  }
}
const cleared = { status: "unreconciled" as const, reconciliationId: null, journalEntryId: null, transferTransactionId: null, transferGroupId: null };
export async function unreconcileBankTransaction(ctx: AuthContext, id: string, request?: Request) {
  requireRole(ctx, "manage:banking");
  return db.transaction(async tx => {
    const base = await lockOrg(tx, ctx), { bank, row } = await loadMovement(tx, ctx, id);
    if (row.status !== "reconciled") fail("Transaction is not reconciled");
    if (!row.journalEntryId) unsupported("Reconciled transaction lacks qualified journal history");
    const saved = await savedJournal(tx, ctx, row.journalEntryId); await matchBankLeg(tx, ctx, bank, row, base, saved);
    const history = await histories(tx, ctx, id), links = await tx.select().from(bankTransaction).where(eq(bankTransaction.journalEntryId, saved.entry.id)).for("update");
    const livePayments = await tx.select().from(payment).where(and(sql`(${payment.bankTransactionId} = ${id} or ${payment.journalEntryId} = ${saved.entry.id})`, isNull(payment.deletedAt))).for("update");
    const claims = await tx.select().from(expenseClaim).where(eq(expenseClaim.journalEntryId, saved.entry.id)).for("update");
    const meta = { paymentId: null as string | null, reversedAllocations: 0, voidedJournalEntryId: null as string | null,
      reversalEntryId: null as string | null, unwoundTransferLegId: null as string | null, deletedTransferMirror: false, deletedTransaction: false };
    await reopenSession(tx, ctx, bank, row, request);
    if (row.transferTransactionId || row.transferGroupId) {
      if (!row.transferTransactionId || !row.transferGroupId || livePayments.length || claims.length || saved.entry.sourceType !== "bank_transfer" || links.length !== 2) unsupported("Transfer pair has inconsistent or mixed history");
      const counterState = await loadMovement(tx, ctx, row.transferTransactionId), counter = counterState.row;
      if (counter.bankAccountId === bank.id || counter.status !== "reconciled" || counter.journalEntryId !== saved.entry.id || counter.transferTransactionId !== row.id ||
        counter.transferGroupId !== row.transferGroupId || counterState.bank.currencyCode !== bank.currencyCode || BigInt(counter.amount) !== -BigInt(row.amount)) unsupported("Transfer must have reciprocal owned equal-and-opposite saved movements");
      await noHiddenHistory(tx, ctx, counter); await noHiddenHistory(tx, ctx, row);
      await matchBankLeg(tx, ctx, counterState.bank, counter, base, saved); await reopenSession(tx, ctx, counterState.bank, counter, request);
      const audits = await tx.select().from(auditLog).where(and(eq(auditLog.organizationId, ctx.organizationId), inArray(auditLog.action, ["create", "matched_transfer"])));
      const record = audits.map(a => a.changes as Record<string, unknown> | null).find(a => a?.journalEntryId === saved.entry.id && a.transferGroupId === row.transferGroupId);
      if (!record || record.baseCurrencyCode !== base) unsupported("Transfer base currency or paired creation history cannot be established");
      meta.reversalEntryId = await reverseJournal(tx, ctx, saved, id); meta.voidedJournalEntryId = saved.entry.id; meta.unwoundTransferLegId = counter.id;
      for (const [movement, parent] of [[row, bank], [counter, counterState.bank]] as const) {
        const synthetic = movement.sourceType === "transfer" && !movement.importId;
        // Audit proves which legs were created; never guess from sourceType alone.
        const proven = synthetic && (record.fromTransactionId === movement.id || record.toTransactionId === movement.id || (record.counterTransactionId === movement.id && record.mirrorCreated === true));
        if (synthetic && !proven) unsupported("Synthetic transfer origin is ambiguous");
        if (proven) await tx.delete(bankTransaction).where(eq(bankTransaction.id, movement.id));
        else await tx.update(bankTransaction).set(cleared).where(eq(bankTransaction.id, movement.id));
        if (movement.id === id) meta.deletedTransaction = proven; else meta.deletedTransferMirror = proven;
        await audit(tx, ctx, "bank_transaction", movement.id, "unreconciled_transfer", { counterpartId: movement.id === id ? counter.id : id, bankAccountId: parent.id, deleted: proven, reversalEntryId: meta.reversalEntryId }, request);
      }
    } else {
      if (links.length !== 1 || links[0].id !== row.id || row.sourceType === "transfer") unsupported("Statement has shared or incomplete journal history");
      const existingPayment = history.some(h => h.action === "matched_existing_payment" && h.changes?.journalEntryId === saved.entry.id);
      const existingJournal = history.some(h => ["matched_existing_journal", "reconciled"].includes(h.action) && h.changes?.journalEntryId === saved.entry.id);
      if (livePayments.length) {
        const pay = livePayments[0]; publicMoneyDto(pay, ["amount"]);
        if (livePayments.length !== 1 || claims.length || pay.organizationId !== ctx.organizationId || pay.bankTransactionId !== id || pay.journalEntryId !== saved.entry.id ||
          pay.bankAccountId !== bank.id || pay.currencyCode !== bank.currencyCode || BigInt(pay.amount) !== (row.amount < 0 ? -BigInt(row.amount) : BigInt(row.amount)) || pay.type !== (row.amount > 0 ? "received" : "made") || pay.stripePaymentIntentId)
          unsupported("Statement cash payment identity or amount is inconsistent");
        meta.paymentId = pay.id;
        const allocations = await tx.select().from(paymentAllocation).where(eq(paymentAllocation.paymentId, pay.id)).for("update");
        const kind = pay.type === "received" ? "invoice" : "bill";
        let allocated = 0n;
        for (const allocation of allocations) {
          publicMoneyDto(allocation, ["amount"]);
          if (allocation.documentType !== kind || allocation.amount <= 0) unsupported("Noncash or invalid allocations cannot be treated as bank cash");
          const table = kind === "invoice" ? invoice : bill;
          const [doc] = await tx.select().from(table).where(and(eq(table.id, allocation.documentId), eq(table.organizationId, ctx.organizationId), isNull(table.deletedAt))).for("share");
          if (!doc || doc.contactId !== pay.contactId || doc.currencyCode !== pay.currencyCode) unsupported("Cash allocations reference an unavailable or foreign document");
          publicMoneyDto(doc, ["total", "amountPaid", "amountDue"]); allocated += BigInt(allocation.amount);
        }
        if (!allocations.length || allocated !== BigInt(pay.amount) || new Set(allocations.map(a => a.documentId)).size !== allocations.length) unsupported("Cash allocations must distinctly and fully cover the saved payment");
        if (saved.entry.sourceType !== "payment" || saved.entry.sourceId !== pay.id || saved.entry.date !== pay.date) unsupported("Cash payment journal origin is inconsistent");
        const [settlement] = await tx.select().from(auditLog).where(and(eq(auditLog.organizationId, ctx.organizationId), eq(auditLog.entityType, "payment"), eq(auditLog.entityId, pay.id), eq(auditLog.action, "settle")));
        if ((settlement?.changes as { baseCurrencyCode?: string } | null)?.baseCurrencyCode !== base) unsupported("Cash payment saved base-currency history is missing or changed");
        if (existingPayment) await tx.update(payment).set({ bankTransactionId: null, updatedAt: new Date() }).where(eq(payment.id, pay.id));
        else {
          if (!history.some(h => ["matched_invoice", "matched_bill", "split_matched"].includes(h.action) && h.changes?.paymentId === pay.id && h.changes?.baseCurrencyCode === base)) unsupported("Bank-created payment origin/base history is missing");
          const result = await reversePaymentInTransaction(tx, ctx, pay.id, request, id);
          if ("reversalEntryId" in result) { meta.reversalEntryId = result.reversalEntryId; meta.reversedAllocations = result.reversedAllocations; }
          meta.voidedJournalEntryId = saved.entry.id;
        }
      } else if (claims.length) {
        requireRole(ctx, "manage:expenses"); const claim = claims[0]; publicMoneyDto(claim, ["totalAmount"]);
        const record = history.find(h => h.action === "expense_created" && h.changes?.expenseClaimId === claim.id && h.changes?.journalEntryId === saved.entry.id)?.changes;
        if (claims.length !== 1 || saved.entry.sourceType !== "bank_expense" || saved.entry.sourceId !== claim.id || claim.organizationId !== ctx.organizationId || claim.deletedAt || claim.status !== "paid" ||
          row.amount >= 0 || claim.currencyCode !== bank.currencyCode || BigInt(claim.totalAmount) !== -BigInt(row.amount) || record?.baseCurrencyCode !== base) unsupported("Bank expense requires complete saved origin and paid history");
        const items = await tx.select().from(expenseItem).where(eq(expenseItem.expenseClaimId, claim.id)).for("update");
        let total = 0n;
        for (const item of items) {
          publicMoneyDto(item, ["amount"]); rateDateSchema.parse(item.date); await assertNotLocked(ctx.organizationId, item.date, ctx);
          if (item.amount < 0) unsupported("Invalid saved expense item");
          for (const [id, table] of [[item.accountId, chartAccount], [item.taxRateId, taxRate], [item.costCenterId, costCenter]] as const) {
            if (!id) continue;
            const [owned] = await tx.select({ id: table.id }).from(table).where(and(eq(table.id, id), eq(table.organizationId, ctx.organizationId)));
            if (!owned) unsupported("Expense item has a foreign reference");
          }
          total += BigInt(item.amount);
        }
        if (!items.length || total !== BigInt(claim.totalAmount)) unsupported("Bank expense lines do not equal the saved total");
        meta.reversalEntryId = await reverseJournal(tx, ctx, saved, id); meta.voidedJournalEntryId = saved.entry.id;
        await tx.update(expenseClaim).set({ deletedAt: new Date(), updatedAt: new Date() }).where(eq(expenseClaim.id, claim.id));
        await audit(tx, ctx, "expense", claim.id, "bank_unreconcile", { bankTransactionId: id, reversalEntryId: meta.reversalEntryId }, request);
      } else if (!existingJournal) {
        const sources = ["bank_categorization", "bank_categorization_split", "bank_reconciliation_adjustment"];
        if (!sources.includes(saved.entry.sourceType ?? "") || (saved.entry.sourceType === "bank_reconciliation_adjustment" ? saved.entry.sourceId !== bank.id : saved.entry.sourceId !== id)) unsupported("Unknown bank posting origin; no destructive generic journal undo");
        const records = saved.entry.sourceType === "bank_reconciliation_adjustment"
          ? (await tx.select().from(auditLog).where(and(eq(auditLog.organizationId, ctx.organizationId), eq(auditLog.entityType, "bank_account"), eq(auditLog.entityId, bank.id)))).map(a => a.changes as Record<string, unknown>)
          : history.map(h => h.changes);
        if (!records.some(r => r?.journalEntryId === saved.entry.id && r.baseCurrencyCode === base)) unsupported("Saved bank posting base currency cannot be established");
        meta.reversalEntryId = await reverseJournal(tx, ctx, saved, id); meta.voidedJournalEntryId = saved.entry.id;
      }
      if (row.sourceType === "reconciliation_adjustment") { await tx.delete(bankTransaction).where(eq(bankTransaction.id, id)); meta.deletedTransaction = true; }
      else await tx.update(bankTransaction).set(cleared).where(eq(bankTransaction.id, id));
    }
    const transaction = await movementDto(tx, ctx, bank, { ...row, ...cleared });
    const result = { transaction, ...meta }; stringifyWire(result);
    await audit(tx, ctx, "bank_transaction", id, "unreconciled", { previousStatus: row.status, ...meta, amountMinor: transaction.amountMinor }, request); return result;
  });
}
export async function excludeBankTransaction(ctx: AuthContext, id: string, request?: Request) {
  requireRole(ctx, "manage:banking");
  return db.transaction(async tx => {
    await lockOrg(tx, ctx); const { bank, row } = await loadMovement(tx, ctx, id);
    if (row.status === "reconciled" || row.journalEntryId || row.reconciliationId || row.transferTransactionId || row.transferGroupId || row.sourceType === "transfer") fail("Undo linked reconciliation history before excluding a statement");
    await noHiddenHistory(tx, ctx, row);
    const status = row.status === "excluded" ? "unreconciled" : "excluded";
    const [updated] = await tx.update(bankTransaction).set({ status }).where(eq(bankTransaction.id, id)).returning();
    const result = { transaction: await movementDto(tx, ctx, bank, updated) }; stringifyWire(result);
    await audit(tx, ctx, "bank_transaction", id, status === "excluded" ? "exclude" : "restore", { previousStatus: row.status, amountMinor: result.transaction.amountMinor }, request); return result;
  });
}
