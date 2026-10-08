import { db } from "@/lib/db";
import { bankAccount, bankTransaction, bankStatementImport, bankReconciliation, organization } from "@/lib/db/schema";
import { and, eq, gte, lte, ne, isNull, inArray, sql, desc } from "drizzle-orm";
import { AuthError, type AuthContext } from "@/lib/api/auth-context";
import { requireRole } from "@/lib/api/require-role";
import { WireCompatibilityError } from "@/lib/money/wire";
import { reportMinor } from "./statement-wire";
import { analyticsCurrency, analyticsMoney } from "./document-analytics-wire";
import { bankCashFlowParams, bankPeriod, bankStatusSchema } from "./bank-analytics-wire";

type Snapshot = Parameters<Parameters<typeof db.transaction>[0]>[0];
const sum = (values: bigint[]) => values.reduce((a, b) => a + b, 0n);

async function accounts(tx: Snapshot, org: string, id: string | undefined, active: boolean) {
  const rows = await tx.select({ id: bankAccount.id, accountName: bankAccount.accountName, currencyCode: bankAccount.currencyCode,
    balance: sql<string>`${bankAccount.balance}::text` }).from(bankAccount)
    .where(and(eq(bankAccount.organizationId, org), isNull(bankAccount.deletedAt), id ? eq(bankAccount.id, id) : undefined,
      active ? eq(bankAccount.isActive, true) : undefined)).orderBy(bankAccount.id);
  if (id && !rows.length) throw new AuthError("Bank account not found", 404);
  return rows.map(row => ({ ...row, currencyCode: analyticsCurrency(row.currencyCode) }));
}

export async function getBankCashFlow(ctx: AuthContext, input: unknown) {
  requireRole(ctx, "view:data");
  const params = bankCashFlowParams(input);
  return db.transaction(async tx => {
    const owned = await accounts(tx, ctx.organizationId, params.bankAccountId, false);
    if (params.bankAccountId && params.currencyCode && owned[0].currencyCode !== params.currencyCode)
      throw new WireCompatibilityError("Bank account currency does not match currencyCode");
    const selected = owned.filter(row => !params.currencyCode || row.currencyCode === params.currencyCode);
    const currencies = new Set(selected.map(row => row.currencyCode));
    if (currencies.size > 1) throw new WireCompatibilityError("Mixed bank currencies require bankAccountId or currencyCode; no implicit FX");
    const org = await tx.query.organization.findFirst({ where: eq(organization.id, ctx.organizationId), columns: { defaultCurrency: true } });
    if (!org) throw new AuthError("Organization not found", 404);
    const currencyCode = params.currencyCode ?? [...currencies][0] ?? analyticsCurrency(org.defaultCurrency ?? "USD");
    const conditions = and(inArray(bankTransaction.bankAccountId, selected.map(row => row.id)), ne(bankTransaction.status, "excluded"),
      gte(bankTransaction.date, params.startDate), lte(bankTransaction.date, params.endDate));
    const [mismatch] = await tx.select({ count: sql<string>`count(*)::text` }).from(bankTransaction)
      .where(and(conditions, sql`${bankTransaction.currencyCode} is not null and ${bankTransaction.currencyCode} <> ${currencyCode}`));
    if (BigInt(mismatch.count)) throw new WireCompatibilityError("Transaction currency differs from bank currency");
    const period = sql`date_trunc(${params.groupBy}, ${bankTransaction.date}::timestamp)::date`;
    const rows = await tx.select({ periodStart: sql<string>`${period}::text`,
      inflows: sql<string>`coalesce(sum(case when ${bankTransaction.amount} > 0 then ${bankTransaction.amount}::numeric else 0 end),0)::text`,
      outflows: sql<string>`coalesce(sum(case when ${bankTransaction.amount} < 0 then ${bankTransaction.amount}::numeric else 0 end),0)::text`,
      net: sql<string>`coalesce(sum(${bankTransaction.amount}::numeric),0)::text` })
      .from(bankTransaction).where(conditions).groupBy(sql`1`).orderBy(sql`1`);
    let running = 0n;
    const periods = rows.map(row => {
      const net = BigInt(row.net); running += net;
      return { ...bankPeriod(row.periodStart, params.groupBy), ...analyticsMoney("inflows", BigInt(row.inflows)),
        ...analyticsMoney("outflows", BigInt(row.outflows)), ...analyticsMoney("net", net), ...analyticsMoney("balance", running) };
    });
    return { currencyCode, periods, totals: { ...analyticsMoney("inflows", sum(rows.map(row => BigInt(row.inflows)))),
      ...analyticsMoney("outflows", sum(rows.map(row => BigInt(row.outflows)))), ...analyticsMoney("net", running) } };
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
}

export async function getBankReconciliationStatus(ctx: AuthContext, input: unknown) {
  requireRole(ctx, "view:data");
  const params = bankStatusSchema.parse(input);
  const today = new Date().toISOString().slice(0, 10);
  return db.transaction(async tx => {
    const owned = await accounts(tx, ctx.organizationId, params.bankAccountId, true);
    const result = [];
    for (const account of owned) {
      const scope = eq(bankTransaction.bankAccountId, account.id);
      const [mismatch] = await tx.select({ count: sql<string>`count(*)::text` }).from(bankTransaction)
        .where(and(scope, ne(bankTransaction.status, "excluded"), sql`${bankTransaction.currencyCode} is not null and ${bankTransaction.currencyCode} <> ${account.currencyCode}`));
      if (BigInt(mismatch.count)) throw new WireCompatibilityError("Transaction currency differs from bank currency");
      const bucket = sql`case when ${today}::date - ${bankTransaction.date} between 0 and 7 then 'week'
        when ${today}::date - ${bankTransaction.date} between 8 and 30 then 'month'
        when ${today}::date - ${bankTransaction.date} between 31 and 60 then 'twoMonths' else 'older' end`;
      const aging = await tx.select({ bucket: sql<string>`${bucket}`, count: sql<string>`count(*)::text`,
        total: sql<string>`coalesce(sum(abs(${bankTransaction.amount}::numeric)),0)::text` }).from(bankTransaction)
        .where(and(scope, eq(bankTransaction.status, "unreconciled"))).groupBy(sql`1`);
      const agingMap: Record<string, { count: number; total: number; totalMinor: string }> = Object.fromEntries(
        ["week", "month", "twoMonths", "older"].map(key => [key, { count: 0, ...analyticsMoney("total", 0n) }]));
      for (const row of aging) agingMap[row.bucket] = { count: reportMinor(BigInt(row.count)), ...analyticsMoney("total", BigInt(row.total)) };
      const [movement] = await tx.select({ total: sql<string>`coalesce(sum(${bankTransaction.amount}::numeric),0)::text`,
        latest: sql<string | null>`max(${bankTransaction.date})::text` }).from(bankTransaction).where(and(scope, ne(bankTransaction.status, "excluded")));
      const [lastImport] = await tx.select({ date: bankStatementImport.createdAt, fileName: bankStatementImport.fileName, endDate: bankStatementImport.statementEndDate })
        .from(bankStatementImport).where(and(eq(bankStatementImport.bankAccountId, account.id), eq(bankStatementImport.organizationId, ctx.organizationId)))
        .orderBy(desc(bankStatementImport.createdAt), desc(bankStatementImport.id)).limit(1);
      const [lastRecon] = await tx.select({ endDate: bankReconciliation.endDate, status: bankReconciliation.status }).from(bankReconciliation)
        .where(eq(bankReconciliation.bankAccountId, account.id)).orderBy(desc(bankReconciliation.createdAt), desc(bankReconciliation.id)).limit(1);
      const days = lastImport?.endDate && movement.latest ? Math.floor((Date.parse(`${movement.latest}T00:00:00Z`) - Date.parse(`${lastImport.endDate}T00:00:00Z`)) / 86400000) : 0;
      result.push({ id: account.id, accountName: account.accountName, currencyCode: account.currencyCode,
        ...analyticsMoney("balance", BigInt(account.balance)), ...analyticsMoney("balanceDiscrepancy", BigInt(account.balance) - BigInt(movement.total)),
        unreconciled: { count: reportMinor(sum(aging.map(row => BigInt(row.count)))), ...analyticsMoney("total", sum(aging.map(row => BigInt(row.total)))), aging: agingMap },
        lastImport: lastImport ? { date: lastImport.date.toISOString(), fileName: lastImport.fileName } : null,
        lastReconciliation: lastRecon ?? null,
        gaps: days > 1 ? { hasGap: true, gapStart: lastImport!.endDate, gapEnd: movement.latest, gapDays: days }
          : { hasGap: false, gapStart: null, gapEnd: null, gapDays: null } });
    }
    return { accounts: result };
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
}
