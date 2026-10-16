import { z } from "zod";
import { coreStoredMinor } from "./core-presentation";
import { taxUiCurrency } from "./tax-ui";
export { financialStatementJson as analyticalReportJson } from "./financial-statement-ui";
export { bankMoneyDisplay as analyticalMoney } from "./bank-display";

const currency = z.string().transform(taxUiCurrency);
const integer = z.number().int().refine(value => Number.isSafeInteger(value) && !Object.is(value, -0));
const count = integer.nonnegative();
const decimal = z.number().finite();
const amount = z.bigint();
const sum = (values: bigint[]) => values.reduce((total, value) => total + value, 0n);
function equal(actual: bigint, expected: bigint) {
  if (actual !== expected) throw new RangeError("Analytical report totals disagree");
}
export const analyticalAbs = (value: bigint) => value < 0n ? -value : value;

/** Validate every supplied alias before any projection can discard it. Required
 * money fields are then enforced as bigint by the report-specific schemas. */
function adopt(value: unknown, expectedCurrency?: string): unknown {
  if (Array.isArray(value)) return value.map(item => adopt(item, expectedCurrency));
  if (!value || typeof value !== "object") return value;
  const row = value as Record<string, unknown>;
  const code = "currencyCode" in row ? currency.parse(row.currencyCode) : expectedCurrency;
  if (expectedCurrency && code !== expectedCurrency) throw new RangeError("Analytical report currencies disagree");
  const output = Object.fromEntries(Object.entries(row).map(([key, item]) => [key, adopt(item, code)]));
  for (const key of Object.keys(row)) if (key.endsWith("Minor")) {
    const field = key.slice(0, -5);
    if (!/^(0|-?[1-9]\d*)$/.test(z.string().parse(row[key]))) throw new RangeError("Invalid analytical amount alias");
    output[field] = coreStoredMinor(integer.parse(row[field]), row[key] as string);
  }
  if ("currencyCode" in row) output.currencyCode = currency.parse(row.currencyCode);
  return output;
}
const cashPeriod = z.object({ label: z.string(), startDate: z.string(), endDate: z.string(), inflows: amount, outflows: amount, net: amount, balance: amount });
export function bankAccountPickerUi(value: unknown) {
  return z.object({ bankAccounts: z.array(z.object({ id: z.string(), accountName: z.string(), currencyCode: currency })) }).parse(value);
}
export function bankCashFlowUi(value: unknown) {
  const data = z.object({ currencyCode: currency, periods: z.array(cashPeriod), totals: z.object({ inflows: amount, outflows: amount, net: amount }) }).parse(adopt(value));
  let running = 0n;
  for (const row of data.periods) { equal(row.net, row.inflows + row.outflows); running += row.net; equal(row.balance, running); }
  equal(data.totals.inflows, sum(data.periods.map(row => row.inflows)));
  equal(data.totals.outflows, sum(data.periods.map(row => row.outflows)));
  equal(data.totals.net, running);
  return data;
}
const bucket = z.object({ count, total: amount });
export function bankStatusUi(value: unknown) {
  const data = z.object({ accounts: z.array(z.object({ id: z.string(), accountName: z.string(), currencyCode: currency,
    balance: amount, balanceDiscrepancy: amount,
    unreconciled: z.object({ count, total: amount, aging: z.object({ week: bucket, month: bucket, twoMonths: bucket, older: bucket }) }),
    lastImport: z.object({ date: z.string().datetime({ offset: true }), fileName: z.string() }).nullable(),
    lastReconciliation: z.object({ endDate: z.string(), status: z.string() }).nullable(),
    gaps: z.object({ hasGap: z.boolean(), gapStart: z.string().nullable(), gapEnd: z.string().nullable(), gapDays: count.nullable() }) })) }).parse(adopt(value));
  for (const row of data.accounts) {
    const buckets = Object.values(row.unreconciled.aging);
    equal(row.unreconciled.total, sum(buckets.map(row => row.total)));
    equal(BigInt(row.unreconciled.count), sum(buckets.map(row => BigInt(row.count))));
  }
  return data;
}
export { cashForecastUi } from "./contact-dashboard-ui";
export function duplicateDetectionUi(value: unknown) {
  const data = z.object({ totalGroups: count, duplicateGroups: z.array(z.object({ type: z.enum(["invoice", "bill"]), contactName: z.string(), amount, currencyCode: currency,
    items: z.array(z.object({ id: z.string(), number: z.string(), date: z.string(), status: z.string() })).min(2) })) }).parse(adopt(value));
  if (data.totalGroups !== data.duplicateGroups.length) throw new RangeError("Duplicate group count disagrees");
  return data;
}
export function financialCalendarUi(value: unknown) {
  return z.object({ events: z.array(z.object({ date: z.string(), type: z.enum(["invoice_due", "bill_due", "recurring_generation", "budget_period_start"]),
    title: z.string(), amount, currencyCode: currency, id: z.string().optional(), status: z.string().optional() })) }).parse(adopt(value));
}
export function executiveSummaryUi(value: unknown) {
  const data = z.object({ currencyCode: currency, priorPeriod: z.object({ startDate: z.string(), endDate: z.string() }),
    kpis: z.array(z.object({ key: z.string(), label: z.string(), current: amount, prior: amount, delta: amount, deltaPercent: decimal.nullable() })) }).parse(adopt(value));
  for (const row of data.kpis) equal(row.delta, row.current - row.prior);
  return data;
}
export function expenseAnalyticsUi(value: unknown) {
  const data = z.object({ currencyCode: currency, totalExpenses: amount, monthlyAverage: amount,
    categories: z.array(z.object({ accountId: z.string(), accountName: z.string(), accountCode: z.string(), total: amount, transactions: count, percentage: decimal })),
    monthlyTrend: z.array(z.object({ month: z.string(), total: amount })) }).parse(adopt(value));
  equal(data.totalExpenses, sum(data.categories.map(row => row.total)));
  equal(data.totalExpenses, sum(data.monthlyTrend.map(row => row.total)));
  return data;
}
export function profitabilityUi(value: unknown) {
  const data = z.object({ currencyCode: currency, totalRevenue: amount, totalCosts: amount, totalProfit: amount, overallMargin: decimal,
    entries: z.array(z.object({ contactId: z.string(), contactName: z.string(), revenue: amount, costs: amount, profit: amount, margin: decimal, invoiceCount: count, billCount: count })) }).parse(adopt(value));
  for (const row of data.entries) equal(row.profit, row.revenue - row.costs);
  equal(data.totalRevenue, sum(data.entries.map(row => row.revenue)));
  equal(data.totalCosts, sum(data.entries.map(row => row.costs)));
  equal(data.totalProfit, data.totalRevenue - data.totalCosts);
  return data;
}
export function vendorSpendUi(value: unknown) {
  const data = z.object({ currencyCode: currency, totalSpend: amount,
    vendors: z.array(z.object({ contactId: z.string(), contactName: z.string(), totalSpend: amount, billCount: count, avgBillAmount: amount, lastBillDate: z.string(), percentage: decimal })) }).parse(adopt(value));
  equal(data.totalSpend, sum(data.vendors.map(row => row.totalSpend)));
  return data;
}
const timing = z.object({ contactId: z.string(), contactName: z.string(), avgDays: integer, avgTermDays: integer, lateCount: count, onTimeRate: decimal });
export function paymentPerformanceUi(value: unknown) {
  return z.object({ currencyCode: currency, avgDaysToCollect: integer, avgDaysToPay: integer,
    receivables: z.array(timing.extend({ invoiceCount: count, totalCollected: amount, totalCollectedMinor: z.string() })),
    payables: z.array(timing.extend({ billCount: count, totalPaid: amount, totalPaidMinor: z.string() })) }).parse(adopt(value));
}
export const ratioKeys = ["currentRatio", "quickRatio", "debtToEquity", "grossMargin", "netMargin", "dso", "dpo", "returnOnAssets", "returnOnEquity"] as const;
export function financialRatiosUi(value: unknown) {
  const data = z.object({ currencyCode: currency,
    ratios: z.object(Object.fromEntries(ratioKeys.map(key => [key, decimal.nullable()])) as Record<typeof ratioKeys[number], z.ZodNullable<typeof decimal>>),
    ratiosExact: z.object(Object.fromEntries(ratioKeys.map(key => [key, z.string().nullable()])) as Record<typeof ratioKeys[number], z.ZodNullable<z.ZodString>>),
    balances: z.object({ totalAssets: amount, currentAssets: amount, totalLiabilities: amount, currentLiabilities: amount, totalEquity: amount,
      inventory: amount, totalRevenue: amount, totalExpenses: amount, netIncome: amount, receivablesDue: amount, payablesDue: amount }) }).parse(adopt(value));
  for (const key of ratioKeys) {
    const value = data.ratios[key], exact = data.ratiosExact[key], days = key === "dso" || key === "dpo";
    if (value === null && exact === null) continue;
    if (value === null || exact === null || !(days ? /^(0|-?[1-9]\d*)$/ : /^-?(0|[1-9]\d*)\.\d{2}$/).test(exact) ||
        value.toFixed(days ? 0 : 2) !== exact) throw new RangeError("Financial ratio aliases disagree");
  }
  equal(data.balances.netIncome, data.balances.totalRevenue - data.balances.totalExpenses);
  return data;
}
