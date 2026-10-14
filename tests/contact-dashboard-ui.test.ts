import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { contactDetailUi, contactListUi, contactCreditDecimal, contactCreditInput, contactActivityUi, contactStatementUi,
  cashForecastUi, forecastChartPoint, displayMoney, displayJson, dashboardAlertsUi, dashboardTrendsUi, displayPercent } from "../lib/money/contact-dashboard-ui";
import { statementMoneyText, statementCellNumber } from "../lib/reports/statement-money";
import { generateCSV } from "../lib/import-export/csv-utils";

const amount = (key: string, value: number) => ({ [key]: value, [`${key}Minor`]: String(value) });
const high = 9007199254740991;
const contact = { id: "c", currencyCode: "KWD", creditLimit: high, creditLimitMinor: String(high) };
const statement = { contact: { id: "c", name: "Customer", email: null, type: "both" }, startDate: "2026-01-01", endDate: "2026-01-31", currencyCode: "KWD",
  ...amount("openingBalance", -2), ...amount("closingBalance", 1247), ...amount("totalDebit", 1250), ...amount("totalCredit", 1),
  transactions: [{ date: "2026-01-01", type: "invoice", documentNumber: "I", description: "test", currencyCode: "KWD", ...amount("debit", 1250), ...amount("credit", 1), ...amount("balance", 1247) }] };
const forecast = { currencyCode: "KWD", forecastPeriod: { start: "2026-01-01", end: "2026-01-08", weeks: 1 },
  ...amount("totalInflows", high), ...amount("totalOutflows", 1), ...amount("netForecast", high - 1),
  weeks: [{ weekOf: "2025-12-28", entryCount: 2, ...amount("inflows", high), ...amount("outflows", 1), ...amount("net", high - 1), ...amount("cumulativeNet", high - 1) }] };

test("Contact limits round-trip saved low digits at every currency scale", () => {
  for (const [currencyCode, decimal] of [["USD", "90071992547409.91"], ["JPY", String(high)], ["IRR", String(high)], ["KWD", "9007199254740.991"]]) {
    const data = contactDetailUi({ ...contact, currencyCode });
    assert.equal(data.creditLimit, BigInt(high));
    assert.equal(contactCreditDecimal(data.creditLimit, currencyCode), decimal);
    assert.deepEqual(contactCreditInput(decimal, currencyCode), { creditLimitMinor: String(high) });
  }
  assert.deepEqual(contactCreditInput("", ""), { creditLimitMinor: null });
  for (const invalid of ["1x", "-1", "1.001", "9007199254740992", "1e3"]) assert.throws(() => contactCreditInput(invalid, "USD"));
  for (const row of [{ creditLimitMinor: "1" }, { creditLimit: null }, { creditLimitMinor: undefined }, { currencyCode: null }, { creditLimit: -1, creditLimitMinor: "-1" }]) {
    assert.throws(() => contactDetailUi({ ...contact, ...row }));
  }
  const balances = { ...contact, ...amount("owesYou", high), ...amount("youOwe", -1), ...amount("overdue", 1250) };
  assert.equal(contactListUi(balances).owesYou, BigInt(high));
  assert.throws(() => contactListUi({ ...balances, overdueMinor: "1251" }));
});
test("Statement adopts signed balances and checks currencies, movements and exact totals", () => {
  assert.equal(contactStatementUi(statement).closingBalance, 1247n);
  assert.equal(displayMoney(contactStatementUi(statement).closingBalance, "KWD").match(/1\.247/)?.[0], "1.247");
  for (const patch of [{ closingBalanceMinor: "1248" }, { totalDebit: 1251, totalDebitMinor: "1251" },
    { transactions: [{ ...statement.transactions[0], currencyCode: "USD" }] },
    { transactions: [{ ...statement.transactions[0], balance: 1248, balanceMinor: "1248" }] }]) assert.throws(() => contactStatementUi({ ...statement, ...patch }));
});
test("Activity rejects missing, unsafe and disagreeing amounts without currency conversion", () => {
  const row = { id: "i", type: "invoice", number: "I", status: "sent", date: "2026-01-01", createdAt: "now", currencyCode: "JPY", ...amount("amount", high) };
  assert.equal(contactActivityUi({ activity: [row], nextCursor: null, hasMore: false }).activity[0].amount, BigInt(high));
  for (const patch of [{ amountMinor: undefined }, { amount: high + 1 }, { amountMinor: "01" }, { amountMinor: "-0", amount: -0 }, { currencyCode: "jpy" }])
    assert.throws(() => contactActivityUi({ activity: [{ ...row, ...patch }], nextCursor: null, hasMore: false }));
});
test("Forecast retains exact tooltip values even where floating geometry loses a low digit", () => {
  const row = cashForecastUi(forecast), point = forecastChartPoint(row.weeks[0], row.currencyCode);
  assert.equal(point.inflowsExact, BigInt(high));
  assert.match(displayMoney(point.inflowsExact, row.currencyCode), /740\.991/);
  for (const currencyCode of ["USD", "JPY", "IRR", "KWD"]) assert.equal(cashForecastUi({ ...forecast, currencyCode }).totalInflows, BigInt(high));
  for (const patch of [{ netForecastMinor: "0" }, { weeks: [{ ...forecast.weeks[0], cumulativeNetMinor: "0" }] },
    { weeks: [{ ...forecast.weeks[0], net: 0, netMinor: "0" }] }, { weeks: [] }, { currencyCode: "XXX" }]) assert.throws(() => cashForecastUi({ ...forecast, ...patch }));
});
test("Dashboard alert currency groups and sparkline aliases are validated", () => {
  const data = { overdueInvoices: { count: 1, currencyCode: "JPY", ...amount("total", 1250) },
    overdueBills: { count: 1, currencyCode: "KWD", ...amount("total", 1250) }, uncategorizedTransactions: 0, accountsNeedingReconciliation: [] };
  assert.equal(dashboardAlertsUi(data).overdueBills.total, 1250n);
  assert.throws(() => dashboardAlertsUi({ ...data, overdueInvoices: { ...data.overdueInvoices, totalMinor: "1251" } }));
  const trend = { currencyCode: "KWD", revenueSparkline: [1250], revenueSparklineMinor: ["1250"], expenseSparkline: [1], expenseSparklineMinor: ["1"], netIncomeSparkline: [1249], netIncomeSparklineMinor: ["1249"] };
  assert.equal(dashboardTrendsUi(trend).revenue[0], 1.25);
  assert.throws(() => dashboardTrendsUi({ ...trend, revenueSparklineMinor: [] }));
  assert.throws(() => dashboardTrendsUi({ ...trend, netIncomeSparkline: [1], netIncomeSparklineMinor: ["1"] }));
  assert.equal(displayPercent(BigInt(high), BigInt(high)), 100);
  assert.equal(displayPercent(9n, 10n), 90);
  assert.equal(displayPercent(-5n, 10n), -50);
  assert.ok(Number.isFinite(displayPercent(-BigInt(high), 1n)));
});
test("Shared export display keeps exact decimal/text cells and rejects lossy numeric spreadsheets", () => {
  assert.match(statementMoneyText(BigInt(high), "KWD"), /740\.991/);
  assert.equal(statementCellNumber(1250n, "KWD"), 1.25);
  assert.throws(() => statementCellNumber(BigInt(high), "KWD"));
  assert.equal(generateCSV([{ amount: BigInt(high), currencyCode: "KWD" }], ["amount", "currencyCode"]), `amount,currencyCode\n${high},KWD`);
});
test("Failed HTTP and malformed JSON never adopt financial state", async () => {
  await assert.rejects(displayJson(new Response(JSON.stringify(statement), { status: 422 }), contactStatementUi), /Unable to load/);
  await assert.rejects(displayJson(Response.json({ ...statement, closingBalanceMinor: "0" }), contactStatementUi), /invalid/);
});
test("Scoped screens have no legacy money imports; chart tooltip uses exact payload", () => {
  for (const path of ["app/(dashboard)/contacts/page.tsx", ...["layout", "page", "bookkeeping/page", "activity/page", "statement/page"].map(name => `app/(dashboard)/contacts/[id]/${name}.tsx`), "app/(dashboard)/dashboard/page.tsx", "components/dashboard/cash-flow-widget.tsx"]) {
    const source = readFileSync(path, "utf8");
    assert.ok(!source.includes('from "@/lib/money"'), path);
  }
  assert.match(readFileSync("components/dashboard/cash-flow-widget.tsx", "utf8"), /entry\.payload\[.*Exact/);
});
