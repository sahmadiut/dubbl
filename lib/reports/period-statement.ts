import { db } from "@/lib/db";
import { organization, costCenter, project } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { AuthError, type AuthContext } from "@/lib/api/auth-context";
import { requireRole } from "@/lib/api/require-role";
import { analyticsCurrency } from "./document-analytics-wire";
import { aggregateByDateRangeExact, type ExactAccountAggregate, type GLQueryOptions } from "./gl-query";
import { reportDecimal, reportMinor } from "./statement-wire";
import { comparisonWindows, incomeStatementSchema, periodInputError, periodRange, profitLossSchema, periodChangePercent } from "./period-statement-wire";
import type { Statement, StatementRow } from "./statement-export";

type Snapshot = Parameters<Parameters<typeof db.transaction>[0]>[0];
const sum = (rows: ExactAccountAggregate[]) => rows.reduce((total, row) => total + row.balance, 0n);
const amount = <T extends string>(key: T, value: bigint) => ({ [key]: reportMinor(value), [`${key}Minor`]: value.toString() }) as Record<T, number> & Record<`${T}Minor`, string>;
const decimal = <T extends string>(key: T, value: bigint) => ({ [key]: reportDecimal(value), [`${key}Minor`]: value.toString() }) as Record<T | `${T}Minor`, string>;

async function readStatement<T>(ctx: AuthContext, read: (tx: Snapshot, currency: string) => Promise<T>) {
  requireRole(ctx, "view:data");
  return db.transaction(async tx => {
    const org = await tx.query.organization.findFirst({ where: eq(organization.id, ctx.organizationId), columns: { defaultCurrency: true } });
    if (!org) throw new AuthError("Organization not found", 404);
    return read(tx, analyticsCurrency(org.defaultCurrency ?? "USD"));
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
}

export async function readExactIncomePeriod(tx: Snapshot, organizationId: string, startDate: string, endDate: string, options: GLQueryOptions = {}) {
  const accounts = await aggregateByDateRangeExact(organizationId, periodRange(startDate, endDate), {
    ...options, database: tx, accountTypes: ["revenue", "expense"],
  });
  const revenue = accounts.filter(row => row.type === "revenue"), expenses = accounts.filter(row => row.type === "expense");
  const totalRevenue = sum(revenue), totalExpenses = sum(expenses);
  return { startDate, endDate, revenue, expenses, totalRevenue, totalExpenses, netIncome: totalRevenue - totalExpenses };
}
type ExactPeriod = Awaited<ReturnType<typeof readExactIncomePeriod>>;
function numericPeriod(value: ExactPeriod, codes = true) {
  const row = (account: ExactAccountAggregate) => ({ accountId: account.accountId, accountName: account.name,
    ...(codes ? { accountCode: account.code } : {}), ...amount("balance", account.balance) });
  return { startDate: value.startDate, endDate: value.endDate, revenue: value.revenue.map(row), expenses: value.expenses.map(row),
    ...amount("totalRevenue", value.totalRevenue), ...amount("totalExpenses", value.totalExpenses), ...amount("netIncome", value.netIncome) };
}

export async function getProfitLoss(ctx: AuthContext, input: unknown) {
  requireRole(ctx, "view:data");
  const params = profitLossSchema.parse(input);
  const today = new Date().toISOString().slice(0, 10);
  const range = periodRange(params.startDate ?? `${today.slice(0, 4)}-01-01`, params.endDate ?? today);
  if ((params.compareFrom === undefined) !== (params.compareTo === undefined)) throw periodInputError("Both comparison dates are required");
  const compare = params.compareFrom && params.compareTo ? periodRange(params.compareFrom, params.compareTo) : undefined;
  const basis = params.basis ?? "accrual";
  const dimension = params.costCenterId !== undefined ? "costCenterId" : params.projectId !== undefined ? "projectId" : undefined;
  const raw = dimension ? params[dimension] : undefined;
  const dimensionValue = raw === "none" || raw === "null" || raw === "" ? null : raw;
  return readStatement(ctx, async (tx, currency) => {
    if (dimension && dimensionValue) {
      const table = dimension === "costCenterId" ? costCenter : project;
      const owned = await tx.select({ id: table.id }).from(table).where(and(eq(table.id, dimensionValue), eq(table.organizationId, ctx.organizationId))).limit(1);
      if (!owned.length) throw new AuthError("Report dimension not found", 404);
    }
    const options: GLQueryOptions = { basis, ...(dimension ? { dimension, dimensionValue } : {}) };
    const primary = await readExactIncomePeriod(tx, ctx.organizationId, range.startDate, range.endDate, options);
    const comparison = compare ? await readExactIncomePeriod(tx, ctx.organizationId, compare.startDate, compare.endDate, options) : undefined;
    const statement = (): Statement => {
      const buildRows = (rows: ExactAccountAggregate[], prior: ExactAccountAggregate[] = []): StatementRow[] => {
        const current = new Map(rows.map(row => [row.accountId, row]));
        const previous = new Map(prior.map(row => [row.accountId, row]));
        return [...rows, ...prior.filter(row => !current.has(row.accountId))].map(row => ({ code: row.code, name: row.name, depth: 1,
          ...(comparison ? { amounts: [reportMinor(current.get(row.accountId)?.balance ?? 0n), reportMinor(previous.get(row.accountId)?.balance ?? 0n)] }
            : { amount: reportMinor(row.balance) }) }));
      };
      return { title: "Profit and Loss", periodLabel: `${primary.startDate} to ${primary.endDate} (${basis} basis)`, currency,
        ...(comparison ? { columns: [primary, comparison].map(value => `${value.startDate} to ${value.endDate}`) } : {}),
        sections: (["revenue", "expenses"] as const).map(key => {
          const total = key === "revenue" ? "totalRevenue" : "totalExpenses";
          return { label: key === "revenue" ? "Revenue" : "Expenses", rows: buildRows(primary[key], comparison?.[key]),
            ...(comparison ? { subtotals: [reportMinor(primary[total]), reportMinor(comparison[total])] } : { subtotal: reportMinor(primary[total]) }) };
        }), ...(comparison ? { grandTotals: [reportMinor(primary.netIncome), reportMinor(comparison.netIncome)] } : { grandTotal: reportMinor(primary.netIncome) }) };
    };
    return { data: { ...numericPeriod(primary), basis, currencyCode: currency, ...(dimension ? { dimension, dimensionValue } : {}),
      ...(comparison ? { comparison: numericPeriod(comparison) } : {}) }, statement };
  });
}

export async function getIncomeStatement(ctx: AuthContext, input: unknown) {
  requireRole(ctx, "view:data");
  const params = incomeStatementSchema.parse(input);
  const range = periodRange(params.from ?? "0001-01-01", params.to ?? "9999-12-31");
  return readStatement(ctx, async (tx, currency) => {
    const result = await readExactIncomePeriod(tx, ctx.organizationId, range.startDate, range.endDate, { includeEmptyAccounts: true });
    const section = (rows: ExactAccountAggregate[], total: bigint) => ({ accounts: rows.map(row => ({ code: row.code, name: row.name,
      ...decimal("balance", row.balance) })), ...decimal("total", total) });
    return { period: { from: params.from ?? null, to: params.to ?? null }, currencyCode: currency,
      revenue: section(result.revenue, result.totalRevenue), expenses: section(result.expenses, result.totalExpenses), ...decimal("netIncome", result.netIncome) };
  });
}

export async function getPnlComparison(ctx: AuthContext, input: unknown) {
  requireRole(ctx, "view:data");
  const { compareType, windows } = comparisonWindows(input);
  return readStatement(ctx, async (tx, currency) => {
    const results: ExactPeriod[] = [];
    for (const window of windows) results.push(await readExactIncomePeriod(tx, ctx.organizationId, window.startDate, window.endDate));
    return { compareType, currencyCode: currency, periods: results.map((current, index) => {
      const previous = results[index - 1];
      const changes = Object.assign({}, ...(["totalRevenue", "totalExpenses", "netIncome"] as const).map((key, i) => {
        const name = ["revenueChange", "expensesChange", "netIncomeChange"][i];
        return { ...amount(name, previous ? current[key] - previous[key] : 0n), [`${name}Pct`]: previous ? periodChangePercent(current[key], previous[key]) : 0 };
      }));
      return { label: windows[index].label, ...numericPeriod(current, false), ...changes };
    }) };
  });
}
