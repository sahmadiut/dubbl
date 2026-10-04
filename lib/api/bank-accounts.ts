import { and, desc, eq, isNull, ne, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { bankAccount, bankTransaction, bankStatementImport, chartAccount, journalLine, organization, auditLog, payment } from "@/lib/db/schema";
import { legacyMinor, stringifyWire, WireCompatibilityError } from "@/lib/money/wire";
import { AuthError, type AuthContext } from "./auth-context";
import { requireRole } from "./require-role";
import { checkMultiCurrency, checkResourceLimit } from "./check-limit";
import { ensureBankLedgerAccount } from "./bank-ledger";
import { bandFor } from "./bank-ledger-codes";
import { bankAccountIdField, bankAccountCreateSchema, bankAccountUpdateSchema, bankBalanceAlertSchema, bankMinor, bankAccountDto } from "./bank-account-wire";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Account = typeof bankAccount.$inferSelect;
const scope = (ctx: AuthContext, id: string) => and(eq(bankAccount.id, id), eq(bankAccount.organizationId, ctx.organizationId), isNull(bankAccount.deletedAt));
async function lockOrganization(tx: Tx, ctx: AuthContext) {
  const [row] = await tx.select({ id: organization.id }).from(organization).where(eq(organization.id, ctx.organizationId)).for("update");
  if (!row) throw new AuthError("Organization not found", 404);
}
async function load(tx: Tx, ctx: AuthContext, id: string, lock = false) {
  const query = tx.select().from(bankAccount).where(scope(ctx, id));
  const [row] = await (lock ? query.for("update") : query);
  if (!row) throw new AuthError("Bank account not found", 404);
  bankAccountDto(row); return row;
}
async function ledger(tx: Tx, ctx: AuthContext, row: Account, writable = false) {
  if (!row.chartAccountId) return null;
  const [gl] = await tx.select().from(chartAccount).where(and(eq(chartAccount.id, row.chartAccountId), eq(chartAccount.organizationId, ctx.organizationId)));
  if (!gl) throw new WireCompatibilityError("Bank account references a missing or foreign GL account");
  if (gl.currencyCode !== row.currencyCode || gl.type !== bandFor(row.accountType).type)
    throw new WireCompatibilityError("Bank and GL account currency/type disagree");
  if (writable) {
    if (gl.deletedAt || !gl.isActive) throw new AuthError("Bank GL account must be active", 400);
    const [claimed] = await tx.select({ id: bankAccount.id }).from(bankAccount).where(and(eq(bankAccount.chartAccountId, gl.id), ne(bankAccount.id, row.id)));
    if (claimed) throw new AuthError("GL account is already assigned to another bank account", 400);
  }
  return gl;
}
async function dto(tx: Tx, ctx: AuthContext, row: Account, relation = false) {
  const gl = await ledger(tx, ctx, row);
  const result = { ...bankAccountDto(row), ...(relation ? { chartAccount: gl } : {}) };
  stringifyWire(result); return result;
}
async function audit(tx: Tx, ctx: AuthContext, row: Account, action: string, changes: unknown, request?: Request) {
  await tx.insert(auditLog).values({ organizationId: ctx.organizationId, userId: ctx.userId, entityType: "bank_account", entityId: row.id,
    action, changes: JSON.parse(stringifyWire(changes)), ipAddress: request?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
    userAgent: request?.headers.get("user-agent") || null });
}
export async function listBankAccounts(ctx: AuthContext) {
  return db.transaction(async tx => {
    const rows = await tx.select().from(bankAccount).where(and(eq(bankAccount.organizationId, ctx.organizationId), isNull(bankAccount.deletedAt))).orderBy(bankAccount.accountName, bankAccount.id);
    const bankAccounts = []; for (const row of rows) bankAccounts.push(await dto(tx, ctx, row, true));
    return { bankAccounts };
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
}
export async function getBankAccount(ctx: AuthContext, id: string) {
  bankAccountIdField.parse(id);
  return db.transaction(async tx => ({ bankAccount: await dto(tx, ctx, await load(tx, ctx, id), true) }),
    { isolationLevel: "repeatable read", accessMode: "read only" });
}
export async function createBankAccount(ctx: AuthContext, input: unknown, request?: Request) {
  requireRole(ctx, "manage:banking"); const parsed = bankAccountCreateSchema.parse(input);
  const balance = bankMinor(parsed.balance, parsed.balanceMinor) ?? 0;
  const { balanceMinor: alias, ...fields } = parsed; void alias;
  return db.transaction(async tx => {
    await lockOrganization(tx, ctx);
    await checkResourceLimit(ctx.organizationId, bankAccount, bankAccount.organizationId, "bankAccounts", bankAccount.deletedAt);
    await checkMultiCurrency(ctx.organizationId, parsed.currencyCode);
    const [row] = await tx.insert(bankAccount).values({ ...fields, balance, organizationId: ctx.organizationId }).returning();
    await ledger(tx, ctx, row, true);
    await ensureBankLedgerAccount(ctx.organizationId, row, tx);
    const linked = await load(tx, ctx, row.id); await ledger(tx, ctx, linked, true);
    const result = { bankAccount: await dto(tx, ctx, linked) };
    await audit(tx, ctx, linked, "create", result, request); return result;
  });
}
async function hasHistory(tx: Tx, row: Account) {
  const [transactions] = await tx.select({ id: bankTransaction.id }).from(bankTransaction).where(eq(bankTransaction.bankAccountId, row.id)).limit(1);
  const [imports] = await tx.select({ id: bankStatementImport.id }).from(bankStatementImport).where(eq(bankStatementImport.bankAccountId, row.id)).limit(1);
  const [payments] = await tx.select({ id: payment.id }).from(payment).where(eq(payment.bankAccountId, row.id)).limit(1);
  const lines = row.chartAccountId ? await tx.select({ id: journalLine.id }).from(journalLine).where(eq(journalLine.accountId, row.chartAccountId)).limit(1) : [];
  return Boolean(transactions || imports || payments || lines.length);
}
export async function updateBankAccount(ctx: AuthContext, id: string, input: unknown, request?: Request) {
  requireRole(ctx, "manage:banking"); bankAccountIdField.parse(id); const parsed = bankAccountUpdateSchema.parse(input);
  const balance = bankMinor(parsed.balance, parsed.balanceMinor);
  const { balanceMinor: alias, ...fields } = parsed; void alias;
  return db.transaction(async tx => {
    await lockOrganization(tx, ctx); const row = await load(tx, ctx, id, true), before = await dto(tx, ctx, row);
    const next = { ...row, ...fields, balance: balance ?? row.balance };
    const changedCurrency = next.currencyCode !== row.currencyCode;
    const changedLink = next.chartAccountId !== row.chartAccountId;
    const changedType = next.accountType !== row.accountType;
    if ((changedCurrency || changedLink || changedType) && await hasHistory(tx, row))
      throw new AuthError("Bank currency, type and GL link cannot change after statement, payment or opening GL history", 400);
    if (changedCurrency && (row.balance !== 0 || next.balance !== 0 || (row.lowBalanceThreshold ?? 0) !== 0))
      throw new AuthError("Currency changes require zero saved and new balances and threshold", 400);
    await checkMultiCurrency(ctx.organizationId, next.currencyCode);
    if ((changedCurrency || bandFor(next.accountType).type !== bandFor(row.accountType).type) && parsed.chartAccountId === undefined) next.chartAccountId = null;
    await ledger(tx, ctx, next, true);
    const [updated] = await tx.update(bankAccount).set({ ...fields, balance: next.balance, chartAccountId: next.chartAccountId }).where(scope(ctx, id)).returning();
    await ensureBankLedgerAccount(ctx.organizationId, updated, tx);
    const linked = await load(tx, ctx, id); await ledger(tx, ctx, linked, true);
    const result = { bankAccount: await dto(tx, ctx, linked) };
    await audit(tx, ctx, linked, "update", { before, after: result.bankAccount }, request); return result;
  });
}
export async function deleteBankAccount(ctx: AuthContext, id: string, request?: Request) {
  requireRole(ctx, "manage:banking"); bankAccountIdField.parse(id);
  return db.transaction(async tx => {
    await lockOrganization(tx, ctx); const row = await load(tx, ctx, id, true), before = await dto(tx, ctx, row);
    await tx.update(bankAccount).set({ deletedAt: new Date() }).where(scope(ctx, id));
    await audit(tx, ctx, row, "delete", before, request); return { success: true };
  });
}
export async function setBankBalanceAlert(ctx: AuthContext, id: string, input: unknown, request?: Request) {
  requireRole(ctx, "manage:bank-rules"); bankAccountIdField.parse(id); const parsed = bankBalanceAlertSchema.parse(input);
  const threshold = bankMinor(parsed.threshold, parsed.thresholdMinor, true)!;
  return db.transaction(async tx => {
    await lockOrganization(tx, ctx); const row = await load(tx, ctx, id, true), before = await dto(tx, ctx, row);
    const [updated] = await tx.update(bankAccount).set({ lowBalanceThreshold: threshold }).where(scope(ctx, id)).returning();
    const account = await dto(tx, ctx, updated);
    const result = { bankAccountId: id, accountName: account.accountName, currencyCode: account.currencyCode,
      lowBalanceThreshold: account.lowBalanceThreshold, lowBalanceThresholdMinor: account.lowBalanceThresholdMinor,
      currentBalance: account.balance, currentBalanceMinor: account.balanceMinor };
    stringifyWire(result); await audit(tx, ctx, row, "update", { before, after: account }, request); return result;
  });
}
export async function validateBankBalance(ctx: AuthContext, id: string) {
  bankAccountIdField.parse(id);
  return db.transaction(async tx => {
    const account = await load(tx, ctx, id); await ledger(tx, ctx, account);
    const [summary] = await tx.select({ total: sql<string>`coalesce(sum(${bankTransaction.amount}),0)::text`, count: sql<string>`count(*)::text`,
      min: sql<string | null>`min(${bankTransaction.amount})::text`, max: sql<string | null>`max(${bankTransaction.amount})::text`,
      mismatches: sql<string>`count(*) filter (where ${bankTransaction.currencyCode} is not null and ${bankTransaction.currencyCode} <> ${account.currencyCode})::text` })
      .from(bankTransaction).where(eq(bankTransaction.bankAccountId, id));
    if (summary.mismatches !== "0") throw new WireCompatibilityError("Statement transaction currencies disagree with bank account");
    if (summary.min !== null) legacyMinor(BigInt(summary.min)); if (summary.max !== null) legacyMinor(BigInt(summary.max));
    const total = BigInt(summary.total), safe = BigInt(Number.MAX_SAFE_INTEGER);
    if (total < -safe || total > safe) throw new WireCompatibilityError("Statement sum exceeds safe numeric compatibility range");
    const transactionSum = legacyMinor(total), transactionCount = legacyMinor(BigInt(summary.count));
    const latest = await tx.query.bankTransaction.findFirst({ where: and(eq(bankTransaction.bankAccountId, id), sql`${bankTransaction.balance} is not null`),
      orderBy: [desc(bankTransaction.date), desc(bankTransaction.createdAt), desc(bankTransaction.id)], columns: { balance: true } });
    const [foreignImport] = await tx.select({ id: bankStatementImport.id }).from(bankStatementImport).where(and(eq(bankStatementImport.bankAccountId, id), ne(bankStatementImport.organizationId, ctx.organizationId))).limit(1);
    if (foreignImport) throw new WireCompatibilityError("Statement import belongs to another organization");
    const lastImport = await tx.query.bankStatementImport.findFirst({ where: and(eq(bankStatementImport.bankAccountId, id), eq(bankStatementImport.organizationId, ctx.organizationId)),
      orderBy: [desc(bankStatementImport.createdAt), desc(bankStatementImport.id)], columns: { closingBalance: true, statementEndDate: true, statementCurrency: true } });
    if (lastImport?.statementCurrency && lastImport.statementCurrency !== account.currencyCode)
      throw new WireCompatibilityError("Statement import currency disagrees with bank account");
    const issues: string[] = [];
    for (const [value, label] of [[latest?.balance, "latest transaction running balance"], [lastImport?.closingBalance, "last import closing balance"]] as const) {
      if (value != null) {
        legacyMinor(BigInt(value)); const difference = legacyMinor(BigInt(account.balance) - BigInt(value));
        if (difference) issues.push(`Account balance (${account.balance}) differs from ${label} (${value}) by ${difference} minor units (${account.currencyCode})`);
      }
    }
    const result = { bankAccountId: id, currencyCode: account.currencyCode, accountBalance: account.balance, accountBalanceMinor: String(account.balance),
      transactionSum, transactionSumMinor: String(transactionSum), transactionCount,
      latestTransactionBalance: latest?.balance ?? null, latestTransactionBalanceMinor: latest?.balance == null ? null : String(latest.balance),
      lastImportClosingBalance: lastImport?.closingBalance ?? null, lastImportClosingBalanceMinor: lastImport?.closingBalance == null ? null : String(lastImport.closingBalance),
      lastImportDate: lastImport?.statementEndDate ?? null, isBalanced: !issues.length, issues };
    stringifyWire(result); return result;
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
}
