import { db } from "@/lib/db";
import { bill, invoice, contact, organization, journalEntry, journalLine, chartAccount } from "@/lib/db/schema";
import { and, eq, gte, lte, isNull, notInArray, sql } from "drizzle-orm";
import { AuthError, type AuthContext } from "@/lib/api/auth-context";
import { requireRole } from "@/lib/api/require-role";
import { WireCompatibilityError } from "@/lib/money/wire";
import { aggregateByDateRangeExact, aggregateAsAtExact, type ExactAccountAggregate } from "./gl-query";
import { reportMinor } from "./statement-wire";
import { analyticsCurrency, analyticsMoney, analyticsPercentage, analyticsRound, analyticsStoredMinor, documentAnalyticsDates } from "./document-analytics-wire";
import { expenseAnalyticsSchema, executiveSummarySchema, monthlyTrendsSchema, contactProfitabilitySchema, executivePriorPeriod, utcMonthWindow, type KpiAnalyticsKind } from "./kpi-analytics-wire";
import type { Statement } from "./statement-export";

const sum = (values: bigint[]) => values.reduce((total, value) => total + value, 0n);
type Snapshot = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function getKpiAnalytics(ctx: AuthContext, kind: KpiAnalyticsKind, input: unknown) {
  requireRole(ctx, "view:data");
  // Validate before starting the read snapshot; no financial writes in any path.
  if (kind === "monthly-trends") {
    const { months = 6 } = monthlyTrendsSchema.parse(input);
    const window = utcMonthWindow(months);
    return read(ctx, async (tx, currencyCode) => {
      const rows = await ledgerMonths(tx, ctx.organizationId, window.startDate, window.endDate);
      const trend = window.keys.map(month => {
        const revenue = sum(rows.filter(row => row.month === month && row.type === "revenue").map(row => -BigInt(row.total)));
        const expenses = sum(rows.filter(row => row.month === month && row.type === "expense").map(row => BigInt(row.total)));
        return { month, ...analyticsMoney("revenue", revenue), ...analyticsMoney("expenses", expenses), ...analyticsMoney("netIncome", revenue - expenses) };
      });
      return { data: { currencyCode, months: trend, revenueSparkline: trend.map(row => row.revenue),
        revenueSparklineMinor: trend.map(row => row.revenueMinor), expenseSparkline: trend.map(row => row.expenses),
        expenseSparklineMinor: trend.map(row => row.expensesMinor), netIncomeSparkline: trend.map(row => row.netIncome),
        netIncomeSparklineMinor: trend.map(row => row.netIncomeMinor) } };
    });
  }
  const params = (kind === "executive-summary" ? executiveSummarySchema : kind === "profitability" ? contactProfitabilitySchema : expenseAnalyticsSchema).parse(input);
  const range = documentAnalyticsDates({ startDate: params.startDate, endDate: params.endDate,
    ...("currencyCode" in params ? { currencyCode: params.currencyCode } : {}) });
  const prior = kind === "executive-summary" ? executivePriorPeriod(range.startDate, range.endDate) : undefined;
  return read(ctx, async (tx, currencyCode) => {
    if (kind === "profitability") return contactProfitability(tx, ctx.organizationId, range, currencyCode);
    if (kind === "executive-summary") {
      const { basis = "accrual" } = executiveSummarySchema.parse(params);
      const options = { database: tx, basis };
      const currentPL = await aggregateByDateRangeExact(ctx.organizationId, range, { ...options, accountTypes: ["revenue", "expense"] });
      const priorPL = await aggregateByDateRangeExact(ctx.organizationId, prior!, { ...options, accountTypes: ["revenue", "expense"] });
      const currentBS = await aggregateAsAtExact(ctx.organizationId, range.endDate, { ...options, accountTypes: ["asset"] });
      const priorBS = await aggregateAsAtExact(ctx.organizationId, prior!.endDate, { ...options, accountTypes: ["asset"] });
      const by = (rows: ExactAccountAggregate[], type: string) => sum(rows.filter(row => row.type === type).map(row => row.balance));
      const sub = (rows: ExactAccountAggregate[], type: string) => sum(rows.filter(row => row.subType === type &&
        (type !== "cogs" || row.type === "expense")).map(row => row.balance));
      const outstanding = async (table: typeof invoice | typeof bill) => {
        const rows = await tx.select({ date: table.issueDate, currency: table.currencyCode, due: sql<string>`${table.amountDue}::text` })
          .from(table).where(and(eq(table.organizationId, ctx.organizationId), isNull(table.deletedAt),
            notInArray(table.status, ["draft", "void"]), lte(table.issueDate, range.endDate)));
        if (rows.some(row => row.currency !== currencyCode)) throw new WireCompatibilityError("Outstanding documents must use organization currency; no implicit FX");
        const amounts = rows.map(row => ({ date: row.date, due: analyticsStoredMinor(row.due) }));
        return [sum(amounts.map(row => row.due)), sum(amounts.filter(row => row.date <= prior!.endDate).map(row => row.due))] as const;
      };
      const ar = await outstanding(invoice), ap = await outstanding(bill);
      const revenue = [by(currentPL, "revenue"), by(priorPL, "revenue")];
      const expenses = [by(currentPL, "expense"), by(priorPL, "expense")];
      const make = (key: string, label: string, current: bigint, previous: bigint) => ({ key, label,
        ...analyticsMoney("current", current), ...analyticsMoney("prior", previous), ...analyticsMoney("delta", current - previous),
        deltaPercent: previous === 0n ? null : analyticsPercentage(current - previous, previous < 0n ? -previous : previous) });
      const kpis = [make("revenue", "Revenue", revenue[0], revenue[1]),
        make("grossProfit", "Gross Profit", revenue[0] - sub(currentPL, "cogs"), revenue[1] - sub(priorPL, "cogs")),
        make("expenses", "Operating Expenses", expenses[0], expenses[1]),
        make("netIncome", "Net Income", revenue[0] - expenses[0], revenue[1] - expenses[1]),
        make("cash", "Cash on Hand", sub(currentBS, "bank"), sub(priorBS, "bank")),
        make("accountsReceivable", "Accounts Receivable", ...ar), make("accountsPayable", "Accounts Payable", ...ap)];
      const statement: Statement = { title: "Executive Summary", periodLabel: `${range.startDate} to ${range.endDate} (vs ${prior!.startDate} to ${prior!.endDate})`,
        currency: currencyCode, columns: ["This Period", "Prior Period", "Change"], sections: [{ label: "Key Metrics",
          rows: kpis.map(kpi => ({ name: kpi.label, amounts: [kpi.current, kpi.prior, kpi.delta], depth: 1 })) }] };
      return { data: { period: { startDate: range.startDate, endDate: range.endDate }, priorPeriod: prior!, basis, currencyCode, kpis }, statement };
    }
    const accounts = await tx.select({ accountId: chartAccount.id, accountName: chartAccount.name, accountCode: chartAccount.code,
      subType: chartAccount.subType, total: sql<string>`coalesce(sum(${journalLine.debitAmount}) - sum(${journalLine.creditAmount}),0)::text`,
      transactions: sql<string>`count(distinct ${journalEntry.id})::text` })
      .from(journalLine).innerJoin(journalEntry, eq(journalEntry.id, journalLine.journalEntryId)).innerJoin(chartAccount, eq(chartAccount.id, journalLine.accountId))
      .where(ledgerWhere(ctx.organizationId, range.startDate, range.endDate, true))
      .groupBy(chartAccount.id, chartAccount.name, chartAccount.code, chartAccount.subType);
    const sorted = accounts.map(row => ({ ...row, exact: BigInt(row.total) })).sort((a, b) => a.exact === b.exact ? a.accountId.localeCompare(b.accountId) : a.exact > b.exact ? -1 : 1);
    const total = sum(sorted.map(row => row.exact));
    const monthly = await ledgerMonths(tx, ctx.organizationId, range.startDate, range.endDate, true);
    const categories = sorted.map(row => ({ accountId: row.accountId, accountName: row.accountName, accountCode: row.accountCode, subType: row.subType,
      ...analyticsMoney("total", row.exact), transactions: reportMinor(BigInt(row.transactions)), percentage: analyticsPercentage(row.exact, total) }));
    return { data: { startDate: range.startDate, endDate: range.endDate, currencyCode, ...analyticsMoney("totalExpenses", total),
      ...analyticsMoney("monthlyAverage", monthly.length ? analyticsRound(total, BigInt(monthly.length)) : 0n), categories,
      monthlyTrend: monthly.map(row => ({ month: row.month, ...analyticsMoney("total", BigInt(row.total)) })) } };
  });
}

function ledgerWhere(org: string, start: string, end: string, expenseOnly = false) {
  return and(eq(journalEntry.organizationId, org), eq(chartAccount.organizationId, org), eq(journalEntry.status, "posted"),
    isNull(journalEntry.deletedAt), gte(journalEntry.date, start), lte(journalEntry.date, end),
    expenseOnly ? eq(chartAccount.type, "expense") : notInArray(chartAccount.type, ["asset", "liability", "equity"]));
}

async function ledgerMonths(tx: Snapshot, org: string, start: string, end: string, expenseOnly = false) {
  return tx.select({ month: sql<string>`to_char(${journalEntry.date}::date,'YYYY-MM')`, type: chartAccount.type,
    total: sql<string>`coalesce(sum(${journalLine.debitAmount}) - sum(${journalLine.creditAmount}),0)::text` })
    .from(journalLine).innerJoin(journalEntry, eq(journalEntry.id, journalLine.journalEntryId)).innerJoin(chartAccount, eq(chartAccount.id, journalLine.accountId))
    .where(ledgerWhere(org, start, end, expenseOnly)).groupBy(sql`to_char(${journalEntry.date}::date,'YYYY-MM')`, chartAccount.type)
    .orderBy(sql`to_char(${journalEntry.date}::date,'YYYY-MM')`);
}

async function read<T>(ctx: AuthContext, callback: (tx: Snapshot, currency: string) => Promise<T>) {
  return db.transaction(async tx => {
    const org = await tx.query.organization.findFirst({ where: eq(organization.id, ctx.organizationId), columns: { defaultCurrency: true } });
    if (!org) throw new AuthError("Organization not found", 404);
    return callback(tx, analyticsCurrency(org.defaultCurrency ?? "USD"));
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
}

async function contactProfitability(tx: Snapshot, org: string, range: ReturnType<typeof documentAnalyticsDates>, fallback: string) {
  const readRows = (table: typeof invoice | typeof bill) => tx.select({ contactId: table.contactId, contactName: contact.name,
    total: sql<string>`${table.total}::text`, currency: table.currencyCode }).from(table)
    .leftJoin(contact, and(eq(contact.id, table.contactId), eq(contact.organizationId, org), isNull(contact.deletedAt)))
    .where(and(eq(table.organizationId, org), isNull(table.deletedAt), notInArray(table.status, ["draft", "void"]),
      gte(table.issueDate, range.startDate), lte(table.issueDate, range.endDate), range.currencyCode ? eq(table.currencyCode, range.currencyCode) : undefined));
  const invoices = await readRows(invoice), bills = await readRows(bill);
  const currencies = new Set([...invoices, ...bills].map(row => analyticsCurrency(row.currency)));
  if (currencies.size > 1) throw new WireCompatibilityError("Mixed profitability currencies require a currencyCode filter");
  const currencyCode = range.currencyCode ?? [...currencies][0] ?? fallback;
  const costs = new Map<string, { total: bigint; count: number }>();
  for (const row of bills) {
    const group = costs.get(row.contactId) ?? { total: 0n, count: 0 }; group.total += analyticsStoredMinor(row.total); group.count++; costs.set(row.contactId, group);
  }
  const groups = new Map<string, { contactId: string; contactName: string; revenue: bigint; invoiceCount: number }>();
  for (const row of invoices) {
    const group = groups.get(row.contactId) ?? { contactId: row.contactId, contactName: row.contactName ?? "Unknown", revenue: 0n, invoiceCount: 0 };
    group.revenue += analyticsStoredMinor(row.total); group.invoiceCount++; groups.set(row.contactId, group);
  }
  const exact = [...groups.values()].map(row => ({ ...row, costs: costs.get(row.contactId)?.total ?? 0n, billCount: costs.get(row.contactId)?.count ?? 0 }));
  exact.sort((a, b) => { const pa = a.revenue - a.costs, pb = b.revenue - b.costs; return pa === pb ? a.contactId.localeCompare(b.contactId) : pa > pb ? -1 : 1; });
  const entries = exact.map(row => ({ contactId: row.contactId, contactName: row.contactName, invoiceCount: row.invoiceCount, billCount: row.billCount,
    ...analyticsMoney("revenue", row.revenue), ...analyticsMoney("costs", row.costs), ...analyticsMoney("profit", row.revenue - row.costs), margin: analyticsPercentage(row.revenue - row.costs, row.revenue) }));
  const revenue = sum(exact.map(row => row.revenue)), totalCosts = sum(exact.map(row => row.costs));
  return { data: { startDate: range.startDate, endDate: range.endDate, groupBy: "contact", currencyCode, entries,
    ...analyticsMoney("totalRevenue", revenue), ...analyticsMoney("totalCosts", totalCosts), ...analyticsMoney("totalProfit", revenue - totalCosts),
    overallMargin: analyticsPercentage(revenue - totalCosts, revenue) } };
}
