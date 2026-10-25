import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";
import { renderReportPage as render, withIO, flush, has } from "./helpers/report-page";
import { incomeStatementUi, profitLossUi, statementUiMoney } from "../lib/money/financial-statement-ui";
import { generateCSV } from "../lib/import-export/csv-utils";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";

const root = "app/(dashboard)/reports";
const ownership = {
  "LOC-103": ["page.tsx", "loading.tsx", "_components.tsx"],
  "LOC-104": ["profit-and-loss", "income-statement", "executive-summary"],
  "LOC-105": ["balance-sheet", "comparative-balance-sheet", "cash-flow"],
  "LOC-106": ["trial-balance", "general-ledger"],
  "LOC-107": ["aged-receivables", "aged-payables", "payment-performance", "vendor-spend", "duplicate-detection"],
  "LOC-108": ["tracking", "budget-vs-actual", "expense-analytics", "profitability", "pnl-comparison", "financial-ratios"],
  "LOC-109": ["cash-flow-forecast", "financial-calendar"],
  "LOC-110": ["1099", "tax-summary", "vat-return"],
  "LOC-111": ["bank-cash-flow", "bank-reconciliation-status"],
  "LOC-112": ["saved", "custom"],
  "LOC-113": ["schedules"],
  "LOC-114": ["consolidation", "pack"],
};
const namespaces = ["ReportDirectory", "ReportNavigation", "IncomeReports", "BalanceCashReports", "LedgerReports", "AgingVendorReports", "AnalyticalReports", "ForecastCalendarReports", "TaxReports", "BankingReports", "CustomReports", "ScheduledReports", "ConsolidationReports", "ReportPack"] as const;
const ready = { initialLoad: false, loading: false, startDate: "2024-01-01", endDate: "2024-12-31", basis: "cash" };
const caller = "<script>Account & caller</script>";
const amount = 9007199254740001;
const alias = String(amount);
const escape = (v: string) => v.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll("'", "&#x27;");

test("combined reporting inventory has one owner per component and 657 paired Persian messages", () => {
  function files(path: string): string[] {
    return readdirSync(path, { withFileTypes: true }).flatMap(e => e.isDirectory() ? files(`${path}/${e.name}`) : e.name.endsWith(".tsx") ? [`${path}/${e.name}`] : []);
  }
  const assigned = Object.values(ownership).flat().map(p => `${root}/${p.endsWith(".tsx") ? p : `${p}/page.tsx`}`);
  assert.equal(new Set(assigned).size, 34);
  assert.deepEqual(files(root).sort(), assigned.sort());
  let count = 0;
  for (const namespace of namespaces) {
    assert.deepEqual(Object.keys(en[namespace]).sort(), Object.keys(fa[namespace]).sort());
    count += Object.keys(en[namespace]).length;
    for (const [key, value] of Object.entries(fa[namespace])) assert.match(value, /[\u0600-\u06ff]/u, `${namespace}.${key}`);
  }
  assert.equal(count, 657);
});

test("combined source audit rejects authored JSX, display attributes and literal toast/title copy", () => {
  for (const part of Object.values(ownership).flat()) {
    const path = `${root}/${part.endsWith(".tsx") ? part : `${part}/page.tsx`}`;
    const ast = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    function audit(n: ts.Node) {
      if (ts.isJsxText(n)) assert.doesNotMatch(n.text.trim(), /[A-Za-z]/, `${path}: ${n.text.trim()}`);
      if (ts.isJsxAttribute(n) && ["title", "description", "placeholder", "aria-label", "alt", "label", "emptyMessage"].includes(n.name.getText(ast)) && n.initializer && ts.isStringLiteral(n.initializer)) {
        // Email syntax is an intentional example, not authored display prose.
        if (part === "schedules" && n.name.getText(ast) === "placeholder" && n.initializer.text === "name@example.com, another@example.com") return;
        assert.doesNotMatch(n.initializer.text, /[A-Za-z]/, `${path}: ${n.getText(ast)}`);
      }
      if (ts.isCallExpression(n) && /^(toast\.(success|error)|useDocumentTitle)$/.test(n.expression.getText(ast))) assert.ok(!n.arguments.some(ts.isStringLiteral), `${path}: ${n.getText(ast)}`);
      ts.forEachChild(n, audit);
    }
    audit(ast);
  }
});

test("checked income and profit/loss share exact money while pack filters and CSV bytes stay canonical", () => {
  for (const currencyCode of ["USD", "JPY", "KWD"]) {
    const pnl = profitLossUi({ ...ready, currencyCode, revenue: [{ accountId: "rev", accountCode: "4000", accountName: caller, balance: amount, balanceMinor: alias }], expenses: [], totalRevenue: amount, totalRevenueMinor: alias, totalExpenses: 0, totalExpensesMinor: "0", netIncome: amount, netIncomeMinor: alias });
    const income = incomeStatementUi({ currencyCode, revenue: { accounts: [{ code: "4000", name: caller, balance: "90071992547400.01", balanceMinor: alias }], total: "90071992547400.01", totalMinor: alias }, expenses: { accounts: [], total: "0.00", totalMinor: "0" }, netIncome: "90071992547400.01", netIncomeMinor: alias });
    assert.equal(pnl.netIncome, income.netIncome);
    const exports: string[] = [];
    for (const locale of ["en-US", "fa-IR"] as const) {
      const m = locale === "en-US" ? en : fa;
      const profit = render("profit-and-loss", { ...ready, ...pnl }, locale);
      const annual = render("income-statement", { ...ready, data: income, year: 2024 }, locale);
      for (const h of [profit, annual]) {
        assert.ok(h.html.includes(escape(caller)) && !h.html.includes("<script>"));
        assert.ok(h.html.includes(escape(statementUiMoney(pnl.netIncome, currencyCode, { locale, numerals: locale === "fa-IR" ? "arabext" : "latn" }))));
        assert.ok(h.html.includes('href="/reports"'));
        assert.ok(!h.html.includes("MISSING_MESSAGE"));
      }
      assert.ok(profit.html.includes(escape(m.IncomeReports.profitLossTitle)));
      assert.ok(annual.html.includes(escape(m.IncomeReports.incomeTitle)));
      const output = profit.captured.find(c => c.props.filename === "profit-and-loss")!;
      assert.deepEqual(output.props.columns, ["section", "accountCode", "accountName", "currencyCode", "balanceMinor"]);
      const rows = output.props.data as Record<string, unknown>[];
      assert.equal(rows[0].balanceMinor, alias);
      assert.equal(rows[0].section, "Money in");
      exports.push(generateCSV(rows, output.props.columns as string[]));
      const pack = render("pack", ready, locale);
      assert.equal(pack.captured.find(c => c.kind === "a")!.props.href, `/api/v1/reports/pack?startDate=${ready.startDate}&endDate=${ready.endDate}&basis=cash&format=xlsx`);
      for (const h of [profit, pack]) {
        (h.captured.find(c => c.kind === "BasisToggle")!.props.onChange as (v: string) => void)("accrual");
        assert.ok(has(h, "basis", "accrual"));
        (h.captured.find(c => c.kind === "DateRangeFilter")!.props.onDateChange as (s: string, e: string) => void)("2024-02-01", "2024-02-29");
        assert.ok(has(h, "startDate", "2024-02-01") && has(h, "endDate", "2024-02-29"));
      }
    }
    assert.equal(exports[0], exports[1]);
    assert.ok(exports[0].includes(alias));
  }
});

test("combined failed reads hide stale accounts and never adopt malformed report money", async () => {
  for (const locale of ["en-US", "fa-IR"] as const) {
    const m = locale === "en-US" ? en : fa;
    for (const route of ["profit-and-loss", "income-statement"]) {
      const h = render(route, { ...ready, error: true, revenue: [{ accountName: caller, balance: BigInt(amount) }], netIncome: BigInt(amount) }, locale);
      assert.ok(h.html.includes(escape(m.IncomeReports.loadFailed)));
      assert.ok(!h.html.includes(escape(caller)));
    }
    await withIO(async (url, init) => {
      assert.equal(url, `/api/v1/reports/profit-and-loss?startDate=${ready.startDate}&endDate=${ready.endDate}&basis=cash`);
      assert.equal((init!.headers as Record<string, string>)["x-organization-id"], "org-a");
      return Response.json({ currencyCode: "USD", totalRevenueMinor: "0.1", error: "private diagnostics" });
    }, async () => {
      const h = render("profit-and-loss", ready, locale);
      h.effects[0](); await flush();
      assert.ok(has(h, "error", true) && has(h, "loading", false));
      assert.ok(!h.events.some(([key]) => ["revenue", "netIncome", "currencyCode"].includes(key)));
    });
  }
});
