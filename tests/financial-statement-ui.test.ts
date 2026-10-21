import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { balanceSheetUi, trialBalanceUi, incomeStatementUi, profitLossUi, pnlComparisonUi,
  trialBalanceTotals, statementUiMoney, statementDecimalMinor, financialStatementJson,
  statementChartPoint, statementComparisonDates, statementComparisonPeriods } from "../lib/money/financial-statement-ui";
import { generateCSV } from "../lib/import-export/csv-utils";

const amount = 9007199254740001;
const alias = "9007199254740001";
const row = { accountId: "cash", code: "1000", name: "Cash", balance: "90071992547400.01", balanceMinor: alias };
const section = (type: string) => ({ type, accounts: [row], total: row.balance, totalMinor: alias });
const empty = (type: string) => ({ type, accounts: [], total: "0.00", totalMinor: "0" });
const balance = () => ({ asAt: "2024-01-31", currencyCode: "KWD", assets: section("asset"), liabilities: empty("liability"), equity: section("equity") });
const period = () => ({ startDate: "2024-01-01", endDate: "2024-01-31",
  revenue: [{ accountId: "revenue", accountName: "Revenue", balance: amount, balanceMinor: alias }], expenses: [],
  totalRevenue: amount, totalRevenueMinor: alias, totalExpenses: 0, totalExpensesMinor: "0", netIncome: amount, netIncomeMinor: alias });
const comparison = () => ({ currencyCode: "KWD", compareType: "monthly", periods: [{ ...period(), label: "Jan 2024",
  revenueChange: 0, revenueChangeMinor: "0", revenueChangePct: 0, expensesChange: 0, expensesChangeMinor: "0", expensesChangePct: 0,
  netIncomeChange: 0, netIncomeChangeMinor: "0", netIncomeChangePct: 0 }] });
const trial = () => ({ asAt: "2024-01-31", currencyCode: "USD", accounts: ["a", "b"].map(accountId => ({ ...row, accountId, type: "asset",
  debitBalance: row.balance, debitBalanceMinor: alias, creditBalance: "0.00", creditBalanceMinor: "0" })) });

test("fixed-two aliases are validated as raw units and displayed at explicit currency scale", () => {
  assert.equal(statementDecimalMinor(row.balance, alias), 9007199254740001n);
  assert.equal(statementUiMoney(9007199254740001n, "USD"), "$90,071,992,547,400.01");
  assert.match(statementUiMoney(9007199254740001n, "KWD"), /9,007,199,254,740\.001/);
  assert.match(statementUiMoney(9007199254740001n, "JPY"), /9,007,199,254,740,001/);
  assert.match(statementUiMoney(9007199254740001n, "IRR"), /9,007,199,254,740,001/);
  assert.match(statementUiMoney(-1n, "KWD"), /-.*0\.001/);
  for (const value of ["90071992547400.02", "90071992547400.010", "9e13", "-0.00", "00.00", "1.2"]) {
    assert.throws(() => statementDecimalMinor(value, alias));
  }
  for (const value of ["09007199254740001", "9007199254740992", "-0", "1e3", "1.0"]) assert.throws(() => statementDecimalMinor(row.balance, value));
});

test("trial totals can exceed numeric compatibility range without dropping low digits", () => {
  const data = trialBalanceUi(trial());
  assert.deepEqual(trialBalanceTotals(data), [{ debit: 18014398509480002n, credit: 0n }]);
  assert.equal(statementUiMoney(trialBalanceTotals(data)[0].debit, "USD"), "$180,143,985,094,800.02");
  const negative = trial();
  negative.accounts[0] = { ...negative.accounts[0], balance: "-0.01", balanceMinor: "-1", debitBalance: "0.00", debitBalanceMinor: "0", creditBalance: "0.01", creditBalanceMinor: "1" };
  assert.equal(trialBalanceUi(negative).accounts[0].balance, -1n);
  const bad = trial(); bad.accounts[0].debitBalanceMinor = "1";
  assert.throws(() => trialBalanceUi(bad));
});

test("balance and income sections reject missing aliases and inconsistent totals", () => {
  assert.equal(balanceSheetUi(balance()).assets.total, 9007199254740001n);
  const bad = balance(); bad.assets.total = "90071992547400.00";
  assert.throws(() => balanceSheetUi(bad));
  const missing = structuredClone(balance()) as Record<string, unknown>; delete missing.currencyCode;
  assert.throws(() => balanceSheetUi(missing));
  const wrongCurrency = { ...balance(), currencyCode: "kwd" }; assert.throws(() => balanceSheetUi(wrongCurrency));
  const income = { currencyCode: "JPY", revenue: section("revenue"), expenses: empty("expense"), netIncome: row.balance, netIncomeMinor: alias };
  assert.equal(incomeStatementUi(income).netIncome, 9007199254740001n);
  assert.throws(() => incomeStatementUi({ ...income, netIncome: "0.00", netIncomeMinor: "0" }));
  assert.throws(() => incomeStatementUi({ ...income, revenue: { ...income.revenue, accounts: [] } }));
});

test("comparison aliases, first column, dimensions and period deltas are checked", () => {
  const data = { ...balance(), dates: ["2024-01-31", "2023-12-31"], compareDates: ["2023-12-31"] };
  assert.throws(() => balanceSheetUi(data));
  const comparative = { ...data, assets: { ...section("asset"), accounts: [{ ...row, balances: [row.balance, "0.00"], balancesMinor: [alias, "0"] }],
    totals: [row.balance, "0.00"], totalsMinor: [alias, "0"] }, liabilities: { ...empty("liability"), totals: ["0.00", "0.00"], totalsMinor: ["0", "0"] },
    equity: { ...section("equity"), accounts: [{ ...row, balances: [row.balance, "0.00"], balancesMinor: [alias, "0"] }], totals: [row.balance, "0.00"], totalsMinor: [alias, "0"] } };
  assert.equal(statementComparisonPeriods(balanceSheetUi(comparative))[1].assets.accounts[0].balance, 9007199254740001n);
  assert.equal(statementComparisonPeriods(balanceSheetUi(comparative))[0].assets.total, 0n);
  assert.throws(() => balanceSheetUi({ ...comparative, dates: ["2024-01-31", "2024-01-31"] }));
  assert.throws(() => balanceSheetUi({ ...comparative, assets: { ...comparative.assets, totalsMinor: [alias] } }));
  assert.throws(() => balanceSheetUi({ ...comparative, assets: { ...comparative.assets, totals: [row.balance, "0.01"], totalsMinor: [alias, "1"] } }));
  const pnl = pnlComparisonUi(comparison()); assert.equal(pnl.periods[0].totalRevenue, 9007199254740001n);
  assert.throws(() => pnlComparisonUi({ ...comparison(), periods: [{ ...comparison().periods[0], revenueChange: 1, revenueChangeMinor: "1" }] }));
  assert.throws(() => trialBalanceUi({ ...trial(), dates: ["2024-01-31", "2023-12-31"] }));
});

test("numeric minor aliases, comparison and net income fail closed", () => {
  assert.equal(profitLossUi({ ...period(), basis: "cash", currencyCode: "KWD", comparison: period() }).comparison!.totalRevenue, 9007199254740001n);
  for (const change of [{ totalRevenueMinor: "9007199254740000" }, { totalRevenue: 1.5 }, { totalRevenue: 9007199254740992 },
    { totalExpenses: -0 }, { netIncome: 0, netIncomeMinor: "0" }, { revenue: [] }]) {
    assert.throws(() => profitLossUi({ ...period(), basis: "accrual", currencyCode: "USD", ...change }));
  }
  const missing = { ...period(), basis: "accrual", currencyCode: "USD" } as Record<string, unknown>; delete missing.netIncomeMinor;
  assert.throws(() => profitLossUi(missing));
});

test("chart geometry and CSV retain original integer values for exact text", () => {
  const data = pnlComparisonUi(comparison()), point = statementChartPoint(data.periods[0], data.currencyCode);
  assert.equal(point.revenueExact, 9007199254740001n);
  assert.match(statementUiMoney(point.revenueExact, data.currencyCode), /\.001/);
  const csv = generateCSV([{ currencyCode: data.currencyCode, balanceMinor: point.revenueExact.toString() }], ["currencyCode", "balanceMinor"]);
  assert.match(csv, /KWD,9007199254740001/);
});

test("failed HTTP or malformed money cannot become zero-valued report state", async () => {
  await assert.rejects(financialStatementJson(new Response(JSON.stringify({ error: "Denied" }), { status: 403 }), balanceSheetUi), /Unable to load/);
  await assert.rejects(financialStatementJson(new Response(JSON.stringify({ assets: {} })), balanceSheetUi), /Saved report amounts are invalid/);
  await assert.rejects(financialStatementJson(new Response("invalid JSON"), balanceSheetUi), /Saved report amounts are invalid/);
  assert.equal((await financialStatementJson(new Response(JSON.stringify(balance())), balanceSheetUi)).assets.total, 9007199254740001n);
});

test("month cutoffs retain previous month, leap day and UTC year rollover", () => {
  assert.deepEqual(statementComparisonDates("2024-03-01", 3), ["2024-03-01", "2024-02-29", "2024-01-31"]);
  assert.deepEqual(statementComparisonDates("2024-01-01", 3), ["2024-01-01", "2023-12-31", "2023-11-30"]);
  assert.throws(() => statementComparisonDates("2024-01-01", 13));
});

test("owned report pages cannot reintroduce unvalidated monetary floats or approximate tooltips", () => {
  const pages = ["trial-balance", "balance-sheet", "comparative-balance-sheet", "income-statement", "profit-and-loss", "pnl-comparison"];
  for (const page of pages) {
    const source = readFileSync(`app/(dashboard)/reports/${page}/page.tsx`, "utf8");
    assert.match(source, /financialStatementJson/); assert.match(source, /ErrorState/);
    assert.doesNotMatch(source, /parseFloat|Math\.round|from ["']@\/lib\/money["']|\.json\(\)/);
    if (page !== "pnl-comparison") assert.doesNotMatch(source, /\.toFixed\(/);
  }
  const source = readFileSync("app/(dashboard)/reports/pnl-comparison/page.tsx", "utf8");
  assert.match(source, /item\.payload\[item\.dataKey === "revenue" \? "revenueExact" : "expensesExact"\]/);
  assert.doesNotMatch(source, /total(?:Revenue|Expenses)\s*\/\s*100|Number\(value\)/);
  const comparative = readFileSync("app/(dashboard)/reports/comparative-balance-sheet/page.tsx", "utf8");
  assert.equal((comparative.match(/fetch\(/g) ?? []).length, 1);
  assert.match(comparative, /a\.accountId === accountId/);
});
