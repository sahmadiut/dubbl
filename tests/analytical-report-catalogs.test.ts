import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { createTranslator } from "next-intl";
import { trackingReportUi, reportResultMoney } from "../lib/money/report-result-ui";
import { expenseAnalyticsUi, profitabilityUi, financialRatiosUi, ratioKeys, analyticalMoney } from "../lib/money/analytical-report-ui";
import { pnlComparisonUi, statementUiMoney } from "../lib/money/financial-statement-ui";
import { budgetUiPayload, budgetMoney } from "../lib/money/budget-ui";
import { renderReportPage as render, has, flush, withIO, type Harness } from "./helpers/report-page";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";

const locales = ["en-US", "fa-IR"] as const;
const routes = ["tracking", "budget-vs-actual", "expense-analytics", "profitability", "pnl-comparison", "financial-ratios"] as const;
type Route = typeof routes[number];
const caller = "<script>caller & name</script>", large = 9007199254740001n;
const esc = (v: string) => v.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#x27;");
const pairs = (values: Record<string, bigint>) => Object.fromEntries(Object.entries(values).flatMap(([key, value]) => [[key, Number(value)], [`${key}Minor`, String(value)]]));
const ready = { initialLoad: false, loading: false, startDate: "2024-01-01", endDate: "2024-03-15", basis: "cash", dimension: "projectId", currencyCode: "KWD", currencyFilter: "KWD", compareType: "quarterly", periodsCount: 4 };
const tracking = { currencyCode: "KWD", mode: "pnl", columns: [{ key: "p", label: caller, dimensionValue: "p" }, { key: "__none__", label: "Unassigned", dimensionValue: null }],
  sections: [{ label: "Revenue", accounts: [{ accountId: "r", accountCode: "4000", accountName: caller, accountType: "revenue", amounts: [Number(large), 0], amountsMinor: [String(large), "0"], ...pairs({ total: large }) }], totals: [Number(large), 0], totalsMinor: [String(large), "0"], ...pairs({ total: large }) },
    { label: "Expenses", accounts: [], totals: [0, 0], totalsMinor: ["0", "0"], ...pairs({ total: 0n }) }],
  netIncome: { byColumn: [Number(large), 0], byColumnMinor: [String(large), "0"], ...pairs({ total: large }) } };
const budgetList = { data: [{ id: "budget-1", name: caller, startDate: "2024-01-01", endDate: "2024-12-31" }] };
const budget = { currencyCode: "JPY", ...pairs({ totalBudgeted: large, totalActual: -1n, totalVariance: large + 1n, totalBurnRate: 0n }), comparisons: [{ accountId: "r", accountName: caller, accountCode: "4000", variancePct: 0, ...pairs({ budgeted: large, actual: -1n, variance: large + 1n }) }] };
const expense = { currencyCode: "KWD", ...pairs({ totalExpenses: large, monthlyAverage: large }), categories: [{ accountId: "e", accountName: caller, accountCode: "5000", transactions: 2, percentage: 100, ...pairs({ total: large }) }], monthlyTrend: [{ month: "2024-01", ...pairs({ total: large }) }, { month: "2024-02", ...pairs({ total: 0n }) }] };
const profit = { currencyCode: "KWD", overallMargin: -10, ...pairs({ totalRevenue: 1n, totalCosts: large, totalProfit: 1n - large }), entries: [{ contactId: "c", contactName: caller, margin: -10, invoiceCount: 2, billCount: 1, ...pairs({ revenue: 1n, costs: large, profit: 1n - large }) }] };
const period = (revenue: bigint, expenses: bigint) => ({ startDate: "2024-01-01", endDate: "2024-01-31", revenue: [{ accountId: "r", accountName: caller, ...pairs({ balance: revenue }) }], expenses: [{ accountId: "e", accountName: caller, ...pairs({ balance: expenses }) }], ...pairs({ totalRevenue: revenue, totalExpenses: expenses, netIncome: revenue - expenses }) });
const comparison = { currencyCode: "KWD", compareType: "quarterly", periods: [{ ...period(large, 0n), label: "Q1 2024", ...pairs({ revenueChange: 0n, expensesChange: 0n, netIncomeChange: 0n }), revenueChangePct: 0, expensesChangePct: 0, netIncomeChangePct: 0 }, { ...period(large - 1n, 1n), label: "Q2 2024", ...pairs({ revenueChange: -1n, expensesChange: 1n, netIncomeChange: -2n }), revenueChangePct: -1, expensesChangePct: 1, netIncomeChangePct: -1 }] };
const ratios = { currencyCode: "KWD", ratios: Object.fromEntries(ratioKeys.map(key => [key, key === "dso" || key === "dpo" ? 2 : 1.23])), ratiosExact: Object.fromEntries(ratioKeys.map(key => [key, key === "dso" || key === "dpo" ? "2" : "1.23"])), balances: pairs({ totalAssets: large, currentAssets: large, totalLiabilities: 1n, currentLiabilities: 1n, inventory: 1n, totalEquity: large - 1n, totalRevenue: large, totalExpenses: 1n, netIncome: large - 1n, receivablesDue: 1n, payablesDue: 1n }) };
const bodies = { tracking, "budget-vs-actual": budget, "expense-analytics": expense, profitability: profit, "pnl-comparison": comparison, "financial-ratios": ratios };
function state(route: Route): Record<string, unknown> {
  if (route === "tracking") return { ...ready, data: trackingReportUi(tracking) };
  if (route === "budget-vs-actual") { const d = budgetUiPayload(budget); return { ...ready, ...d, budgets: budgetList.data, selectedBudgetId: "budget-1", comparisons: d.comparisons.map((row: { accountId: string; accountName: string; accountCode: string; variancePct: number; budgeted: bigint; actual: bigint; variance: bigint }) => ({ ...row, currencyCode: d.currencyCode })) }; }
  if (route === "expense-analytics") return { ...ready, ...expenseAnalyticsUi(expense) };
  if (route === "profitability") return { ...ready, ...profitabilityUi(profit) };
  if (route === "pnl-comparison") return { ...ready, ...pnlComparisonUi(comparison) };
  return { ...ready, ...financialRatiosUi(ratios) };
}
const tFor = (locale: typeof locales[number]) => createTranslator({ locale, messages: locale === "en-US" ? en : fa, namespace: "AnalyticalReports" });
function expectText(h: Harness, text: string) { assert.ok(h.html.includes(esc(text)), text); }

test("tracking JSX translates finite sections and unassigned headers, preserves exact drilldown/export contracts", () => {
  for (const locale of locales) {
    const t = tFor(locale), h = render("tracking", state("tracking"), locale);
    for (const key of ["trackingTitle", "trackingDescription", "trackingProjectHelp", "exportSpreadsheet", "splitBy", "department", "project", "account", "total", "revenue", "expenses", "totalRevenue", "totalExpenses", "trackingProfit", "unassigned"] as const) expectText(h, t(key));
    expectText(h, caller); assert.ok(!h.html.includes("<script>")); expectText(h, reportResultMoney(large, "KWD", { locale, numerals: locale === "fa-IR" ? "arabext" : "latn" }));
    assert.ok(h.captured.some(c => c.props.href === "/reports/general-ledger?startDate=2024-01-01&endDate=2024-03-15&projectId=p#r"));
    assert.ok(h.captured.some(c => c.props.href === "/api/v1/reports/tracking-category?startDate=2024-01-01&endDate=2024-03-15&basis=cash&dimension=projectId&mode=pnl&format=xlsx"));
    const unassigned = structuredClone(tracking); unassigned.sections[0].accounts[0].amounts.reverse(); unassigned.sections[0].accounts[0].amountsMinor.reverse(); unassigned.sections[0].totals.reverse(); unassigned.sections[0].totalsMinor.reverse(); unassigned.netIncome.byColumn.reverse(); unassigned.netIncome.byColumnMinor.reverse();
    const byDepartment = render("tracking", { ...ready, dimension: "costCenterId", data: trackingReportUi(unassigned) }, locale);
    expectText(byDepartment, t("trackingDepartmentHelp")); assert.ok(byDepartment.captured.some(c => c.props.href === "/reports/general-ledger?startDate=2024-01-01&endDate=2024-03-15&costCenterId=none#r"));
    for (const [key, value] of [["project", "projectId"], ["department", "costCenterId"]] as const) { (h.captured.find(c => c.props.children === t(key))!.props.onClick as () => void)(); assert.ok(has(h, "dimension", value)); }
    (h.captured.find(c => c.kind === "BasisToggle")!.props.onChange as (v: string) => void)("accrual"); assert.ok(has(h, "basis", "accrual"));
  }
});

test("budget JSX localizes headers and shared progress while retaining fixed cents and selector IDs", () => {
  for (const locale of locales) {
    const t = tFor(locale), h = render("budget-vs-actual", state("budget-vs-actual"), locale);
    for (const key of ["budgetTitle", "budgetDescription", "budgetLabel", "code", "account", "budgeted", "actual", "variance", "totalBudgeted", "totalActual", "totalVariance"] as const) expectText(h, t(key));
    expectText(h, t("progressActual", { amount: budgetMoney(-1n, "JPY", { locale, numerals: locale === "fa-IR" ? "arabext" : "latn" }) })); expectText(h, t("progressBudget", { amount: budgetMoney(large, "JPY", { locale, numerals: locale === "fa-IR" ? "arabext" : "latn" }) }));
    expectText(h, budgetMoney(large + 1n, "JPY", { locale, numerals: locale === "fa-IR" ? "arabext" : "latn" })); assert.ok(h.html.includes("width:0%"));
    const item = h.captured.find(c => c.kind === "SelectItem")!.props; assert.equal(item.value, "budget-1"); assert.equal(item.children, caller);
    (h.captured.find(c => c.kind === "Select")!.props.onValueChange as (v: string) => void)("budget-2"); assert.ok(has(h, "selectedBudgetId", "budget-2"));
    const empty = render("budget-vs-actual", ready, locale); expectText(empty, t("noBudgets")); expectText(empty, t("noBudgetsDescription"));
    expectText(render("budget-vs-actual", { ...state("budget-vs-actual"), comparisons: [] }, locale), t("noBudgetLines"));
  }
});

test("expense and profitability JSX localize counts, trends and signed amounts", () => {
  for (const locale of locales) {
    const t = tFor(locale), h = render("expense-analytics", state("expense-analytics"), locale);
    for (const key of ["expenseTitle", "expenseDescription", "totalSpent", "monthlyAverage", "monthlySpending", "byCategory"] as const) expectText(h, t(key));
    expectText(h, t("categoryTransactions", { code: "5000", count: 2 })); expectText(h, analyticalMoney(large, "KWD", { locale, numerals: locale === "fa-IR" ? "arabext" : "latn" }));
    const series = h.captured.find(c => c.props.dataKey === "expenses")!.props; assert.equal(series.name, t("expenses"));
    const chart = h.captured.find(c => Array.isArray(c.props.data) && (c.props.data[0] as { minorUnits?: bigint })?.minorUnits)!.props;
    const data = chart.data as { minorUnits: bigint }[]; assert.equal(data[0].minorUnits, large);
    const tooltip = h.captured.find(c => c.props.formatter)!.props.formatter as (v: number, name: string, item: unknown) => string[];
    assert.deepEqual(tooltip(0, t("expenses"), { payload: data[0] }), [analyticalMoney(large, "KWD", { locale, numerals: locale === "fa-IR" ? "arabext" : "latn" })]);
    const p = render("profitability", state("profitability"), locale);
    for (const key of ["profitTitle", "profitDescription", "moneyIn", "costs", "profit", "overallMargin", "documentCurrency", "clearFilter", "contact", "revenue", "margin", "invoices", "bills", "total"] as const) expectText(p, t(key));
    expectText(p, analyticalMoney(1n - large, "KWD", { locale, numerals: locale === "fa-IR" ? "arabext" : "latn" })); expectText(p, caller); assert.ok(!p.html.includes("<script>"));
    (p.captured.find(c => c.kind === "CurrencySelect")!.props.onValueChange as (v: string) => void)("JPY"); assert.ok(has(p, "currencyFilter", "JPY"));
    (p.captured.find(c => c.props.children === t("clearFilter"))!.props.onClick as () => void)(); assert.ok(has(p, "currencyFilter", ""));
  }
});

test("comparison chart names localize while tooltip amounts follow stable dataKey and exact integers", () => {
  for (const locale of locales) {
    const t = tFor(locale), h = render("pnl-comparison", state("pnl-comparison"), locale);
    for (const key of ["comparisonTitle", "comparisonDescription", "metric", "revenue", "expenses", "netIncome", "change"] as const) expectText(h, t(key));
    const items = h.captured.filter(c => c.kind === "SelectItem").map(c => c.props);
    for (const key of ["monthly", "quarterly", "yearly"] as const) assert.ok(items.some(c => c.value === key && c.children === t(key)));
    for (const count of [3, 4, 6, 8, 12]) assert.ok(items.some(c => c.value === String(count) && c.children === t("periodCount", { count })));
    const selects = h.captured.filter(c => c.kind === "Select"); (selects[0].props.onValueChange as (v: string) => void)("yearly"); (selects[1].props.onValueChange as (v: string) => void)("12"); assert.ok(has(h, "compareType", "yearly") && has(h, "periodsCount", 12));
    const chart = h.captured.find(c => Array.isArray(c.props.data) && (c.props.data[0] as { revenueExact?: bigint })?.revenueExact)!.props;
    const data = chart.data as { revenueExact: bigint; expensesExact: bigint }[]; assert.equal(data[0].revenueExact, large);
    const tooltip = h.captured.find(c => c.props.formatter)!.props.formatter as (v: number, name: string, item: unknown) => unknown[];
    for (const key of ["revenue", "expenses"] as const) {
      assert.equal(h.captured.find(c => c.props.dataKey === key)!.props.name, t(key));
      assert.deepEqual(tooltip(0, t(key), { dataKey: key, payload: data[0] }), [statementUiMoney(key === "revenue" ? large : 0n, "KWD", { locale, numerals: locale === "fa-IR" ? "arabext" : "latn" }), t(key)]);
    }
    expectText(h, statementUiMoney(-1n, "KWD", { locale, numerals: locale === "fa-IR" ? "arabext" : "latn" })); expectText(h, statementUiMoney(-2n, "KWD", { locale, numerals: locale === "fa-IR" ? "arabext" : "latn" }));
  }
});

test("all ratio labels, explanations, exact unit text and balances localize; null ratios remain hidden", () => {
  for (const locale of locales) {
    const t = tFor(locale), h = render("financial-ratios", state("financial-ratios"), locale);
    for (const key of ratioKeys) { expectText(h, t(`${key}Label`)); expectText(h, t(`${key}Description`)); }
    for (const key of ["ratiosTitle", "ratiosDescription", "underlyingBalances", "totalAssets", "currentAssets", "inventory", "totalLiabilities", "currentLiabilities", "totalEquity", "periodRevenue", "periodExpenses", "periodNetIncome", "receivablesDue", "payablesDue"] as const) expectText(h, t(key));
    expectText(h, t("ratioDays", { value: "2" })); expectText(h, "1.23x"); expectText(h, "1.23%"); expectText(h, analyticalMoney(large, "KWD", { locale, numerals: locale === "fa-IR" ? "arabext" : "latn" }));
    const hidden = render("financial-ratios", { ...state("financial-ratios"), ratios: { ...ratios.ratios, currentRatio: null } }, locale); assert.ok(!hidden.html.includes(esc(t("currentRatioDescription"))));
  }
});

test("read effects preserve queries, headers, exact adoption and finite failures", async () => {
  for (const route of routes) for (const mode of ["ok", "http", "json", "money", "network"]) {
    await withIO(async (url, init) => {
      const u = new URL(String(url), "https://local.test"); assert.equal(u.pathname, `/api/v1/reports/${route === "tracking" ? "tracking-category" : route}`);
      assert.deepEqual(Object.fromEntries(u.searchParams), route === "tracking" ? { startDate: ready.startDate, endDate: ready.endDate, basis: "cash", dimension: "projectId", mode: "pnl" } : route === "budget-vs-actual" ? { budgetId: "budget-1" } : route === "pnl-comparison" ? { compare: "quarterly", periods: "4" } : { startDate: ready.startDate, endDate: ready.endDate, ...(route === "profitability" ? { groupBy: "contact", currencyCode: "KWD" } : {}) });
      assert.equal((init?.headers as Record<string, string>)["x-organization-id"], "org-a");
      if (mode === "network") throw new Error("private failure"); if (mode === "json") return new Response("private JSON");
      const body = JSON.parse(JSON.stringify(bodies[route]));
      if (mode === "money") {
        if (route === "tracking") body.netIncome.totalMinor = "1"; else if (route === "budget-vs-actual") body.totalBudgetedMinor = "1"; else if (route === "expense-analytics") body.totalExpensesMinor = "1"; else if (route === "profitability") body.totalRevenueMinor = "2"; else if (route === "pnl-comparison") body.periods[0].totalRevenueMinor = "1"; else body.balances.totalAssetsMinor = "1";
      }
      return Response.json(mode === "http" ? { error: "private server" } : body, { status: mode === "http" ? 403 : 200 });
    }, async () => {
      const h = render(route, state(route)); h.effects[route === "budget-vs-actual" ? 1 : 0](); await flush();
      const errorKey = route === "budget-vs-actual" ? "loadError" : "error"; assert.equal(has(h, errorKey, true), mode !== "ok");
      const dataKey = { tracking: "data", "budget-vs-actual": "comparisons", "expense-analytics": "categories", profitability: "entries", "pnl-comparison": "periods", "financial-ratios": "ratiosExact" }[route];
      const adopted = h.events.filter(([key, value]) => key === dataKey && value !== null && (!Array.isArray(value) || value.length)); assert.equal(adopted.length, mode === "ok" ? 1 : 0);
      assert.ok(has(h, route === "budget-vs-actual" ? "reportLoading" : "loading", false));
      assert.ok(!h.events.some(e => typeof e[1] === "string" && e[1].includes("private")));
    });
  }
});

test("budget list fetch retains first selection and handles errors without exposing server prose", async () => {
  for (const mode of ["ok", "empty", "http", "json", "network"]) await withIO(async (url, init) => {
    assert.equal(url, "/api/v1/budgets?limit=100"); assert.equal((init?.headers as Record<string, string>)["x-organization-id"], "org-a");
    if (mode === "network") throw new Error("private failure"); if (mode === "json") return new Response("bad json");
    return Response.json(mode === "http" ? { error: "private server" } : mode === "empty" ? { data: [] } : budgetList, { status: mode === "http" ? 403 : 200 });
  }, async () => {
    const h = render("budget-vs-actual", ready); h.effects[0](); await flush();
    assert.equal(has(h, "selectedBudgetId", "budget-1"), mode === "ok"); assert.equal(has(h, "loadError", true), !["ok", "empty"].includes(mode)); assert.ok(has(h, "initialLoad", false));
  });
});

test("empty/loading/errors, dates, missing-org and cancelled effects retain safe behavior in both locales", async () => {
  for (const locale of locales) for (const route of routes) {
    const t = tFor(locale);
    expectText(render(route, { ...ready, [route === "budget-vs-actual" ? "loadError" : "error"]: true }, locale), t("loadFailed"));
    assert.ok(render(route, { ...ready, initialLoad: true }, locale).captured.some(c => c.kind === "BrandLoader"));
    const emptyKey = { tracking: "nothingTagged", "budget-vs-actual": "noBudgets", "expense-analytics": "noExpenseData", profitability: "noProfitData", "pnl-comparison": "noComparisonData", "financial-ratios": "noFinancialData" } as const;
    const empty = render(route, ready, locale); expectText(empty, t(emptyKey[route]));
    if (route === "tracking") { expectText(empty, t("noTaggedProject")); expectText(render(route, { ...ready, dimension: "costCenterId" }, locale), t("noTaggedDepartment")); }
    const h = render(route, state(route), locale), range = h.captured.find(c => c.kind === "DateRangeFilter");
    if (range) { (range.props.onDateChange as (s: string, e: string) => void)("2024-02-01", "2024-02-29"); assert.ok(has(h, "startDate", "2024-02-01") && has(h, "endDate", "2024-02-29")); }
    const effectIndices = route === "budget-vs-actual" ? [0, 1] : [0];
    for (const index of effectIndices) for (const reject of [false, true]) await withIO(async () => { if (reject) throw new Error("obsolete"); return Response.json(index === 0 && route === "budget-vs-actual" ? budgetList : bodies[route]); }, async () => {
      const old = render(route, state(route), locale); const cleanup = old.effects[index](); assert.equal(typeof cleanup, "function"); if (cleanup) cleanup(); const count = old.events.length; await flush(); assert.equal(old.events.length, count);
    });
    await withIO(async () => { throw new Error("must not fetch"); }, async () => { const missing = render(route, state(route), locale); for (const index of effectIndices) assert.equal(missing.effects[index](), undefined); assert.equal(missing.events.length, 0); }, null);
  }
});

test("authored report JSX copy is extracted and all new Persian messages contain Persian script", () => {
  for (const [key, value] of Object.entries(fa.AnalyticalReports)) assert.match(value, /[\u0600-\u06ff]/, key);
  for (const route of routes) {
    const file = `app/(dashboard)/reports/${route}/page.tsx`, source = readFileSync(file, "utf8"), ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    function visit(n: ts.Node) {
      if (ts.isJsxText(n)) assert.ok(!/[A-Za-z]/.test(n.text), `${route}: ${n.text.trim()}`);
      if (ts.isJsxAttribute(n) && ["title", "description", "placeholder", "aria-label", "emptyMessage", "name"].includes(n.name.getText(ast)) && n.initializer && ts.isStringLiteral(n.initializer)) assert.ok(!/[A-Za-z]/.test(n.initializer.text), `${route}: ${n.getText(ast)}`);
      ts.forEachChild(n, visit);
    }
    visit(ast);
  }
});
