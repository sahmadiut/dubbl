import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { analyticalReportJson, analyticalMoney, analyticalAbs, bankCashFlowUi, bankStatusUi, cashForecastUi,
  duplicateDetectionUi, financialCalendarUi, executiveSummaryUi, expenseAnalyticsUi, profitabilityUi,
  vendorSpendUi, paymentPerformanceUi, financialRatiosUi, ratioKeys } from "../lib/money/analytical-report-ui";
import { generateCSV } from "../lib/import-export/csv-utils";

const pairs = (values: Record<string, number>) => Object.fromEntries(Object.entries(values).flatMap(([key, value]) => [[key, value], [`${key}Minor`, String(value)]]));
const high = Number.MAX_SAFE_INTEGER;
function cash(currencyCode = "USD") {
  return { currencyCode, periods: [{ label: "Jan", startDate: "2024-01-01", endDate: "2024-01-31", ...pairs({ inflows: high, outflows: -1001, net: high - 1001, balance: high - 1001 }) }],
    totals: pairs({ inflows: high, outflows: -1001, net: high - 1001 }) };
}
test("analytical adoption preserves source units, signed low digits and exact currency CSV", () => {
  for (const code of ["USD", "JPY", "KWD", "IRR"]) {
    const report = bankCashFlowUi(cash(code));
    assert.equal(report.periods[0].inflows, 9007199254740991n);
    assert.equal(report.totals.net, 9007199254739990n);
    const csv = generateCSV(report.periods.map(row => ({ ...row, currencyCode: code })), ["currencyCode", "inflows", "outflows", "net"]);
    assert.ok(csv.includes(`${code},9007199254740991,-1001,9007199254739990`));
    assert.ok(analyticalMoney(report.periods[0].inflows, code).endsWith(code === "JPY" || code === "IRR" ? "991" : code === "KWD" ? ".991" : ".91"));
  }
  assert.equal(analyticalAbs(-9007199254740991n), 9007199254740991n);
  assert.equal(analyticalMoney(-1n, "KWD"), "-KWD\u00a00.001");
});

test("missing, malformed, unsafe or conflicting aliases and currency fail before adoption", async () => {
  for (const alias of [undefined, null, "01", "-0", "1e3", "1.0", "9007199254740992", "9007199254740990"]) {
    const dto = cash(); dto.periods[0].inflowsMinor = alias as string;
    assert.throws(() => bankCashFlowUi(dto));
  }
  for (const value of [undefined, null, "9007199254740991", high + 1, 1.1, -0, Infinity]) {
    const dto = cash(); dto.periods[0].inflows = value;
    assert.throws(() => bankCashFlowUi(dto));
  }
  for (const code of [undefined, null, "usd", "ZZZ"]) assert.throws(() => bankCashFlowUi({ ...cash(), currencyCode: code }));
  assert.throws(() => bankCashFlowUi({ ...cash(), periods: [{ ...cash().periods[0], currencyCode: "JPY" }] }));
  assert.throws(() => bankCashFlowUi({ ...cash(), totals: pairs({ inflows: high - 1, outflows: -1001, net: high - 1001 }) }));
  await assert.rejects(analyticalReportJson(new Response('{"periods":[]}', { status: 422 }), bankCashFlowUi), /Unable to load/);
  await assert.rejects(analyticalReportJson(new Response('bad json'), bankCashFlowUi), /invalid/);
  await assert.rejects(analyticalReportJson(Response.json({ error: "wrong" }), bankCashFlowUi), /invalid/);
  assert.equal((await analyticalReportJson(Response.json(cash()), bankCashFlowUi)).totals.inflows, BigInt(high));
});

test("bank aging validates each currency independently and sums beyond safe Number range", () => {
  const account = (currencyCode: string, id: string) => ({ id, accountName: id, currencyCode, ...pairs({ balance: 0, balanceDiscrepancy: -1 }),
    unreconciled: { count: 1, ...pairs({ total: high }), aging: Object.fromEntries(["week", "month", "twoMonths", "older"].map(key => [key, { count: key === "week" ? 1 : 0, ...pairs({ total: key === "week" ? high : 0 }) }])) },
    lastImport: null, lastReconciliation: null, gaps: { hasGap: false, gapStart: null, gapEnd: null, gapDays: null } });
  const dto = { accounts: [account("USD", "1"), account("USD", "2"), account("JPY", "3")] };
  const data = bankStatusUi(dto), totals = new Map<string, bigint>();
  for (const row of data.accounts) totals.set(row.currencyCode, (totals.get(row.currencyCode) ?? 0n) + row.unreconciled.total);
  assert.equal(totals.get("USD"), 18014398509481982n); assert.equal(totals.get("JPY"), 9007199254740991n);
  dto.accounts[0].unreconciled.aging.week.totalMinor = "1";
  assert.throws(() => bankStatusUi(dto));
});

test("forecast and KPI identities preserve refunds and tooltip integers", () => {
  const dto = { currencyCode: "KWD", forecastPeriod: { start: "2024-01-07", end: "2024-01-14", weeks: 1 }, ...pairs({ totalInflows: high, totalOutflows: 1, netForecast: high - 1 }),
    weeks: [{ weekOf: "2024-01-07", entryCount: 2, ...pairs({ inflows: high, outflows: 1, net: high - 1, cumulativeNet: high - 1 }) }] };
  const forecast = cashForecastUi(dto); assert.equal(analyticalMoney(forecast.weeks[0].inflows, "KWD"), "KWD\u00a09,007,199,254,740.991");
  assert.throws(() => cashForecastUi({ ...dto, weeks: [{ ...dto.weeks[0], cumulativeNetMinor: "0" }] }));
  const kpi = { key: "revenue", label: "Revenue", ...pairs({ current: -1, prior: 1001, delta: -1002 }), deltaPercent: -100.1 };
  const summary = { currencyCode: "USD", priorPeriod: { startDate: "2023-01-01", endDate: "2023-01-31" }, kpis: [kpi] };
  assert.equal(executiveSummaryUi(summary).kpis[0].delta, -1002n);
  assert.throws(() => executiveSummaryUi({ ...summary, kpis: [{ ...kpi, ...pairs({ delta: 1 }) }] }));
  const expense = { currencyCode: "USD", ...pairs({ totalExpenses: -1, monthlyAverage: -1 }),
    categories: [{ accountId: "1", accountName: "Refund", accountCode: "5000", transactions: 1, percentage: 0, ...pairs({ total: -1 }) }],
    monthlyTrend: [{ month: "2024-01", ...pairs({ total: -1 }) }] };
  assert.equal(expenseAnalyticsUi(expense).monthlyTrend[0].total, -1n);
  assert.throws(() => expenseAnalyticsUi({ ...expense, monthlyTrend: [] }));
});

test("vendor, profitability and payment timing require their own money pairs", () => {
  const vendor = { contactId: "v", contactName: "Vendor", billCount: 2, lastBillDate: "2024-01-01", percentage: 100,
    ...pairs({ totalSpend: 2003, avgBillAmount: 1002 }) };
  const spend = { currencyCode: "JPY", ...pairs({ totalSpend: 2003 }), vendors: [vendor] };
  assert.equal(vendorSpendUi(spend).vendors[0].avgBillAmount, 1002n);
  assert.throws(() => vendorSpendUi({ ...spend, vendors: [{ ...vendor, avgBillAmountMinor: "1001" }] }));
  const entry = { contactId: "c", contactName: "Customer", invoiceCount: 1, billCount: 1, margin: 50, ...pairs({ revenue: 2003, costs: 1001, profit: 1002 }) };
  const profit = { currencyCode: "USD", overallMargin: 50, ...pairs({ totalRevenue: 2003, totalCosts: 1001, totalProfit: 1002 }), entries: [entry] };
  assert.equal(profitabilityUi(profit).totalProfit, 1002n);
  assert.throws(() => profitabilityUi({ ...profit, entries: [] }));
  const timing = { currencyCode: "KWD", avgDaysToCollect: 2, avgDaysToPay: 0, payables: [], receivables: [{ contactId: "c", contactName: "Customer", avgDays: 2,
    avgTermDays: 1, lateCount: 1, onTimeRate: 50, invoiceCount: 2, ...pairs({ totalCollected: high }) }] };
  assert.equal(paymentPerformanceUi(timing).receivables[0].totalCollected, BigInt(high));
  assert.throws(() => paymentPerformanceUi({ ...timing, receivables: [{ ...timing.receivables[0], totalCollected: 1 }] }));
});

test("calendar and duplicate groups keep separate currencies and require amounts", () => {
  const event = { date: "2024-01-01", type: "budget_period_start", title: "Budget", currencyCode: "IRR", ...pairs({ amount: 1250 }) };
  assert.equal(financialCalendarUi({ events: [event, { ...event, currencyCode: "USD" }] }).events[0].amount, 1250n);
  assert.throws(() => financialCalendarUi({ events: [{ ...event, amountMinor: undefined }] }));
  const group = { type: "invoice", contactName: "Customer", currencyCode: "JPY", ...pairs({ amount: 1250 }),
    items: ["a", "b"].map(id => ({ id, number: id, date: "2024-01-01", status: "sent" })) };
  assert.equal(duplicateDetectionUi({ totalGroups: 1, duplicateGroups: [group] }).duplicateGroups[0].amount, 1250n);
  assert.throws(() => duplicateDetectionUi({ totalGroups: 0, duplicateGroups: [group] }));
  assert.throws(() => duplicateDetectionUi({ totalGroups: 1, duplicateGroups: [{ ...group, amountMinor: "1251" }] }));
});

test("ratios validate exact decimal aliases separately from minor-unit balances", () => {
  const dto = { currencyCode: "KWD", ratios: Object.fromEntries(ratioKeys.map(key => [key, null as number | null])),
    ratiosExact: Object.fromEntries(ratioKeys.map(key => [key, null as string | null])),
    balances: pairs({ totalAssets: high, currentAssets: high, totalLiabilities: 0, currentLiabilities: 0, totalEquity: 0, inventory: 0,
      totalRevenue: 2003, totalExpenses: 1001, netIncome: 1002, receivablesDue: 0, payablesDue: 0 }) };
  dto.ratios.currentRatio = 1.23; dto.ratiosExact.currentRatio = "1.23";
  dto.ratios.dso = 2; dto.ratiosExact.dso = "2";
  const data = financialRatiosUi(dto); assert.equal(data.balances.totalAssets, BigInt(high)); assert.equal(data.ratiosExact.currentRatio, "1.23");
  assert.throws(() => financialRatiosUi({ ...dto, ratiosExact: { ...dto.ratiosExact, currentRatio: "1.24" } }));
  assert.throws(() => financialRatiosUi({ ...dto, ratiosExact: { ...dto.ratiosExact, dso: "2.0" } }));
  assert.throws(() => financialRatiosUi({ ...dto, ratiosExact: { ...dto.ratiosExact, debtToEquity: "0.00" } }));
});

test("all scoped pages adopt validated reports and guard superseded requests", () => {
  const pages = { "bank-cash-flow": "bankCashFlowUi", "bank-reconciliation-status": "bankStatusUi", "cash-flow-forecast": "cashForecastUi",
    "duplicate-detection": "duplicateDetectionUi", "financial-calendar": "financialCalendarUi", "executive-summary": "executiveSummaryUi",
    "expense-analytics": "expenseAnalyticsUi", profitability: "profitabilityUi", "vendor-spend": "vendorSpendUi", "payment-performance": "paymentPerformanceUi", "financial-ratios": "financialRatiosUi" };
  for (const [name, parser] of Object.entries(pages)) {
    const source = readFileSync(`app/(dashboard)/reports/${name}/page.tsx`, "utf8");
    assert.ok(source.includes(`analyticalReportJson(r, ${parser})`), name);
    assert.ok(source.includes("cancelled = true"), name);
    assert.ok(source.includes(".catch("), name);
    assert.ok(source.includes('role="alert"'), name);
    assert.ok(!source.includes('from "@/lib/money"'), name);
  }
});
