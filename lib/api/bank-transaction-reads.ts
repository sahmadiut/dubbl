import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { bankAccount, bankTransaction, bankStatementImport, auditLog, costCenter, project } from "@/lib/db/schema";
import { WireCompatibilityError, stringifyWire } from "@/lib/money/wire";
import { AuthError, type AuthContext } from "./auth-context";
import { requireRole } from "./require-role";
import { bankReadId, bankReadPagination, bankReadCurrency, sameBankReadCurrency, bankReadNullableMoney, bankReadAudit, bankReadCount } from "./bank-transaction-read-wire";
import { suggestAccounts } from "@/lib/banking/account-suggestions";

export type BankReadTx = Parameters<Parameters<typeof db.transaction>[0]>[0];
export function bankReadSnapshot<T>(work: (tx: BankReadTx) => Promise<T>) {
  return db.transaction(async tx => { const result = await work(tx); stringifyWire(result); return result; }, { isolationLevel: "repeatable read", accessMode: "read only" });
}
export async function bankReadAccount(tx: BankReadTx, ctx: AuthContext, id: string) {
  const account = await tx.query.bankAccount.findFirst({ where: and(eq(bankAccount.id, bankReadId.parse(id)), eq(bankAccount.organizationId, ctx.organizationId), sql`${bankAccount.deletedAt} is null`),
    columns: { id: true, organizationId: true, currencyCode: true, chartAccountId: true } });
  if (!account) throw new AuthError("Bank account not found", 404);
  bankReadCurrency(account.currencyCode);
  return account;
}
export async function bankReadTransaction(tx: BankReadTx, ctx: AuthContext, id: string) {
  bankReadId.parse(id);
  const owned = await tx.select({ id: bankTransaction.id, bankAccountId: bankTransaction.bankAccountId }).from(bankTransaction)
    .innerJoin(bankAccount, eq(bankAccount.id, bankTransaction.bankAccountId))
    .where(and(eq(bankTransaction.id, id), eq(bankAccount.organizationId, ctx.organizationId), sql`${bankAccount.deletedAt} is null`));
  if (!owned[0]) throw new AuthError("Bank transaction not found", 404);
  const account = await bankReadAccount(tx, ctx, owned[0].bankAccountId);
  const transaction = (await tx.query.bankTransaction.findFirst({ where: eq(bankTransaction.id, id) }))!;
  sameBankReadCurrency(transaction.currencyCode, account.currencyCode);
  bankReadNullableMoney(transaction, ["amount", "balance"]);
  return { transaction, account };
}
export function bankReadImportDto(row: typeof bankStatementImport.$inferSelect, ctx: AuthContext, account: { id: string; currencyCode: string }) {
  if (row.organizationId !== ctx.organizationId || row.bankAccountId !== account.id) throw new WireCompatibilityError("Invalid bank import ownership");
  sameBankReadCurrency(row.statementCurrency, account.currencyCode);
  return { ...bankReadNullableMoney(row, ["openingBalance", "closingBalance"]), currencyCode: account.currencyCode };
}
export async function checkPlainReferences(tx: BankReadTx, ctx: AuthContext, row: typeof bankTransaction.$inferSelect) {
  if (row.costCenterId) {
    const ref = await tx.query.costCenter.findFirst({ where: eq(costCenter.id, row.costCenterId), columns: { organizationId: true } });
    if (!ref || ref.organizationId !== ctx.organizationId) throw new WireCompatibilityError("Invalid bank cost center ownership");
  }
  if (row.projectId) {
    const ref = await tx.query.project.findFirst({ where: eq(project.id, row.projectId), columns: { organizationId: true } });
    if (!ref || ref.organizationId !== ctx.organizationId) throw new WireCompatibilityError("Invalid bank project ownership");
  }
  if (row.transferTransactionId) {
    const [ref] = await tx.select({ organizationId: bankAccount.organizationId }).from(bankTransaction)
      .innerJoin(bankAccount, eq(bankAccount.id, bankTransaction.bankAccountId)).where(eq(bankTransaction.id, row.transferTransactionId));
    if (!ref || ref.organizationId !== ctx.organizationId) throw new WireCompatibilityError("Invalid bank transfer ownership");
  }
}
export async function listBankTransactionReads(ctx: AuthContext, input: unknown) {
  const params = bankReadPagination(input);
  return bankReadSnapshot(async tx => {
    const account = await bankReadAccount(tx, ctx, params.bankAccountId);
    const conditions = [eq(bankTransaction.bankAccountId, account.id)];
    if (params.status) conditions.push(eq(bankTransaction.status, params.status));
    const rows = await tx.query.bankTransaction.findMany({ where: and(...conditions), orderBy: [desc(bankTransaction.date), desc(bankTransaction.createdAt), asc(bankTransaction.id)], limit: params.limit, offset: params.offset,
      with: { import: true, account: { columns: { id: true, organizationId: true, code: true, name: true } },
        journalEntry: { columns: { organizationId: true } }, reconciliation: { columns: { bankAccountId: true } },
        contact: { columns: { organizationId: true } }, taxRate: { columns: { organizationId: true } } } });
    const transactions = rows.map(({ account: gl, import: imp, journalEntry: journal, reconciliation, contact, taxRate, ...row }) => {
      if (gl && gl.organizationId !== ctx.organizationId) throw new WireCompatibilityError("Invalid bank transaction GL ownership");
      if ([journal, contact, taxRate].some(ref => ref && ref.organizationId !== ctx.organizationId) || (reconciliation && reconciliation.bankAccountId !== account.id))
        throw new WireCompatibilityError("Invalid bank transaction reference ownership");
      return { ...bankReadNullableMoney(row, ["amount", "balance"]), currencyCode: sameBankReadCurrency(row.currencyCode, account.currencyCode),
        import: imp ? bankReadImportDto(imp, ctx, account) : null, accountCode: gl?.code ?? null, accountName: gl?.name ?? null };
    });
    for (const row of rows) await checkPlainReferences(tx, ctx, row);
    const [count] = await tx.select({ total: sql<string>`count(*)::text` }).from(bankTransaction).where(and(...conditions));
    return { transactions, total: bankReadCount(count.total), page: params.page, limit: params.limit };
  });
}
export async function getBankTransactionActivity(ctx: AuthContext, id: string) {
  requireRole(ctx, "manage:banking");
  return bankReadSnapshot(async tx => {
    const { account } = await bankReadTransaction(tx, ctx, id);
    const entries = await tx.query.auditLog.findMany({ where: and(eq(auditLog.organizationId, ctx.organizationId), eq(auditLog.entityType, "bank_transaction"), eq(auditLog.entityId, id)),
      orderBy: [desc(auditLog.createdAt), asc(auditLog.id)], with: { user: { columns: { id: true, name: true, email: true } } } });
    return { currencyCode: account.currencyCode, activity: entries.map(entry => ({ id: entry.id, action: entry.action, changes: bankReadAudit(entry.changes), user: entry.user, createdAt: entry.createdAt })) };
  });
}
export async function getBankAccountSuggestions(ctx: AuthContext, id: string) {
  requireRole(ctx, "manage:banking");
  return bankReadSnapshot(async tx => {
    const { transaction } = await bankReadTransaction(tx, ctx, id);
    return { suggestions: await suggestAccounts(transaction.bankAccountId, transaction.description, 5, tx) };
  });
}
export async function listBankImportReads(ctx: AuthContext, id: string) {
  return bankReadSnapshot(async tx => {
    const account = await bankReadAccount(tx, ctx, id);
    const rows = await tx.query.bankStatementImport.findMany({ where: eq(bankStatementImport.bankAccountId, id), orderBy: [desc(bankStatementImport.createdAt), asc(bankStatementImport.id)], limit: 20 });
    return { imports: rows.map(row => bankReadImportDto(row, ctx, account)) };
  });
}
export async function listBankDuplicates(ctx: AuthContext, id: string) {
  return bankReadSnapshot(async tx => {
    const account = await bankReadAccount(tx, ctx, id);
    // Same signed amount/date/currency; positive and negative flows are distinct.
    const pairs = await tx.execute(sql`select t1.id as id1, t1.description as desc1, t1.reference as ref1, t1.status as status1,
      t2.id as id2, t2.description as desc2, t2.reference as ref2, t2.status as status2,
      t1.date::text as date, t1.amount::text as amount,
      coalesce(t1.currency_code, ${account.currencyCode}) as currency
      from bank_transaction t1 join bank_transaction t2 on t1.bank_account_id = t2.bank_account_id and t1.date = t2.date
      and t1.amount = t2.amount and coalesce(t1.currency_code, ${account.currencyCode}) = coalesce(t2.currency_code, ${account.currencyCode}) and t1.id < t2.id
      where t1.bank_account_id = ${id} order by t1.date desc, t1.amount, t1.id, t2.id limit 100`);
    const groups = new Map<string, { date: string; amount: number; amountMinor: string; currencyCode: string; transactions: { id: string; description: string; reference: string | null; status: string }[] }>();
    for (const row of pairs.rows) {
      sameBankReadCurrency(row.currency as string, account.currencyCode);
      const key = `${row.date}|${row.amount}|${row.currency}`;
      if (!groups.has(key)) groups.set(key, { date: row.date as string, amount: bankReadCount(row.amount as string), amountMinor: row.amount as string, currencyCode: account.currencyCode, transactions: [] });
      const group = groups.get(key)!;
      for (const suffix of ["1", "2"]) if (!group.transactions.some(t => t.id === row[`id${suffix}`])) group.transactions.push({ id: row[`id${suffix}`] as string, description: row[`desc${suffix}`] as string, reference: row[`ref${suffix}`] as string | null, status: row[`status${suffix}`] as string });
    }
    return { bankAccountId: id, duplicateGroups: [...groups.values()], totalGroups: groups.size };
  });
}
