import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { test } from "node:test";
import { createElement, type ComponentType, type ReactNode } from "react";
import * as React from "react";
import * as jsx from "react/jsx-runtime";
import * as nextIntl from "next-intl";
import { createTranslator } from "next-intl";
import ts from "typescript";
import * as BrandLoader from "../components/dashboard/brand-loader";
import * as ReportComponents from "../app/(dashboard)/reports/_components";
import * as DateRangeFilter from "../components/dashboard/date-range-filter";
import * as ErrorState from "../components/dashboard/error-state";
import * as DataTable from "../components/dashboard/data-table";
import * as ExportButton from "../components/dashboard/export-button";
import { incomeStatementUi, profitLossUi, statementUiMoney } from "../lib/money/financial-statement-ui";
import { executiveSummaryUi } from "../lib/money/analytical-report-ui";
import { generateCSV } from "../lib/import-export/csv-utils";
import { renderWithPresentation } from "./helpers/presentation";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";

const routes = ["profit-and-loss", "income-statement", "executive-summary"] as const;
type Route = typeof routes[number];
const locales = ["en-US", "fa-IR"] as const;
type Locale = typeof locales[number];
const translator = (locale: Locale) => createTranslator({ locale, messages: locale === "en-US" ? en : fa, namespace: "IncomeReports" });
const escaped = (v: string) => v.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#x27;");
const caller = "<script>account & label</script>";
const amount = 9007199254740001, alias = String(amount);
const row = { accountId: "rev", accountCode: "4000", accountName: caller, balance: amount, balanceMinor: alias };
const period = { startDate: "2024-01-01", endDate: "2024-01-31", basis: "cash", currencyCode: "KWD" };
const pnl = { ...period, revenue: [row], expenses: [], totalRevenue: amount, totalRevenueMinor: alias, totalExpenses: 0, totalExpensesMinor: "0", netIncome: amount, netIncomeMinor: alias };
const income = { currencyCode: "KWD", revenue: { type: "revenue", accounts: [{ accountId: "rev", code: "4000", name: caller, balance: "90071992547400.01", balanceMinor: alias }], total: "90071992547400.01", totalMinor: alias },
  expenses: { type: "expense", accounts: [], total: "0.00", totalMinor: "0" }, netIncome: "90071992547400.01", netIncomeMinor: alias };
const knownKpis = ["revenue", "grossProfit", "expenses", "netIncome", "cash", "accountsReceivable", "accountsPayable"];
const kpi = (key: string, n: number, percent: number | null) => ({ key, label: caller, current: n, currentMinor: String(n), prior: 0, priorMinor: "0", delta: n, deltaMinor: String(n), deltaPercent: percent });
const executive = { currencyCode: "KWD", priorPeriod: { startDate: "2023-12-01", endDate: "2023-12-31" },
  kpis: [...knownKpis.map((key, i) => kpi(key, i === 0 ? amount : i === 1 ? -1 : 0, i === 0 ? 12.5 : i === 1 ? -2 : null)), kpi("toString", 1, 0)] };
const bodies = { "profit-and-loss": pnl, "income-statement": income, "executive-summary": executive };
const parsers = { "profit-and-loss": profitLossUi, "income-statement": incomeStatementUi, "executive-summary": executiveSummaryUi };
const ready = { initialLoad: false, loading: false, ...period };
type Capture = { kind: string; props: Record<string, unknown> };
type Harness = { html: string; captured: Capture[]; effects: (() => void | (() => void))[]; events: [string, unknown][] };

// Render production JSX and real next-intl/UI/readers; isolate animation and IO.
function render(route: Route, states: Record<string, unknown> = {}, locale: Locale = "en-US"): Harness {
  const file = `app/(dashboard)/reports/${route}/page.tsx`;
  const ast = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const names: string[] = [];
  function hooks(n: ts.Node) {
    if (ts.isVariableDeclaration(n) && ts.isArrayBindingPattern(n.name) && n.initializer && ts.isCallExpression(n.initializer) && n.initializer.expression.getText(ast) === "useState") names.push(n.name.elements[0].getText(ast));
    ts.forEachChild(n, hooks);
  }
  hooks(ast);
  const h: Harness = { html: "", captured: [], effects: [], events: [] };
  const capture = (factory: typeof jsx.jsx) => (kind: unknown, props: Record<string, unknown>, key: string) => {
    h.captured.push({ kind: typeof kind === "string" ? kind : (kind as { name?: string })?.name ?? "", props });
    return factory(kind as Parameters<typeof jsx.jsx>[0], props, key);
  };
  let index = 0;
  const require = createRequire(resolve(file)), compiled = { exports: {} as { default: ComponentType } };
  const load = (id: string): unknown => {
    if (id === "react") return { ...React, useState: (initial: unknown) => {
      const key = names[index++]; return [Object.hasOwn(states, key) ? states[key] : initial, (v: unknown) => h.events.push([key, v])];
    }, useEffect: (fn: () => void | (() => void)) => h.effects.push(fn) };
    if (id === "react/jsx-runtime") return { ...jsx, jsx: capture(jsx.jsx), jsxs: capture(jsx.jsxs) };
    if (id === "next-intl") return nextIntl;
    if (id.endsWith("/brand-loader")) return BrandLoader;
    if (id === "../_components") return ReportComponents;
    if (id.endsWith("/date-range-filter")) return DateRangeFilter;
    if (id.endsWith("/error-state")) return ErrorState;
    if (id.endsWith("/data-table")) return DataTable;
    if (id.endsWith("/export-button")) return ExportButton;
    if (id.endsWith("/content-reveal")) return { ContentReveal: ({ children }: { children: ReactNode }) => createElement("div", null, children) };
    return require(id.startsWith("@/") ? resolve(id.slice(2)) : id);
  };
  const code = ts.transpileModule(ast.text, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  new Function("require", "module", "exports", code)(load, compiled, compiled.exports);
  h.html = renderWithPresentation(createElement(compiled.exports.default), locale);
  return h;
}
const has = (h: Harness, key: string, value: unknown) => h.events.some(e => e[0] === key && e[1] === value);
const flush = async () => { for (let i = 0; i < 6; i++) await new Promise(resolve => setImmediate(resolve)); };
async function withIO(fetcher: typeof fetch, run: () => Promise<void>, org: string | null = "org-a") {
  const original = globalThis.fetch, storage = Object.getOwnPropertyDescriptor(globalThis, "localStorage"), window = Object.getOwnPropertyDescriptor(globalThis, "window");
  globalThis.fetch = fetcher;
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: (key: string) => { assert.equal(key, "activeOrgId"); return org; } } });
  Object.defineProperty(globalThis, "window", { configurable: true, value: { location: { reload() { reloads++; } } } });
  try { await run(); } finally {
    globalThis.fetch = original;
    if (storage) Object.defineProperty(globalThis, "localStorage", storage); else Reflect.deleteProperty(globalThis, "localStorage");
    if (window) Object.defineProperty(globalThis, "window", window); else Reflect.deleteProperty(globalThis, "window");
  }
}
let reloads = 0;

test("income report production JSX renders bilingual copy, exact money, safe data and unchanged exports", () => {
  for (const locale of locales) {
    const t = translator(locale), data = profitLossUi(pnl);
    const h = render("profit-and-loss", { ...ready, ...data }, locale);
    for (const key of ["profitLossTitle", "profitLossDescription", "profitLossHelp", "downloadPdf", "comparePeriods", "splitByTeam", "moneyIn", "moneyOut", "profitShort", "totalMoneyIn", "totalMoneyOut", "profit", "emptyCosts", "code", "account", "amount"] as const) assert.ok(h.html.includes(escaped(t(key))), key);
    assert.ok(h.html.includes(escaped(statementUiMoney(BigInt(amount), "KWD", { locale, numerals: locale === "fa-IR" ? "arabext" : "latn" }))));
    assert.ok(h.html.includes(escaped(caller)) && !h.html.includes("<script>"));
    const hrefs = h.captured.filter(c => c.kind === "a").map(c => c.props.href);
    assert.ok(hrefs.includes("/api/v1/reports/profit-and-loss?startDate=2024-01-01&endDate=2024-01-31&basis=cash&format=pdf"));
    assert.ok(hrefs.includes("/reports/pnl-comparison") && hrefs.includes("/reports/tracking"));
    const exported = h.captured.find(c => c.kind === "ExportButton")!.props;
    assert.deepEqual(exported.columns, ["section", "accountCode", "accountName", "currencyCode", "balanceMinor"]);
    assert.equal(exported.filename, "profit-and-loss");
    const rows = exported.data as Record<string, unknown>[];
    assert.equal(rows[0].section, "Money in"); assert.equal(rows[0].balanceMinor, alias);
    assert.ok(generateCSV(rows, exported.columns as string[]).includes(alias));
    const out = render("profit-and-loss", { ...ready, revenue: [], expenses: [{ ...data.revenue[0], balance: -1n }], totalExpenses: -1n }, locale);
    assert.equal((out.captured.find(c => c.kind === "ExportButton")!.props.data as Record<string, unknown>[])[0].section, "Money out");
    assert.ok(out.html.includes(escaped(t("emptyIncome"))));
    const summary = render("income-statement", { ...ready, data: incomeStatementUi(income), year: 2024 }, locale);
    for (const key of ["incomeTitle", "incomeDescription", "incomeHelp", "year", "totalIncome", "totalCosts", "profit", "code", "account", "amount"] as const) assert.ok(summary.html.includes(escaped(t(key))), key);
    assert.ok(summary.html.includes(escaped(caller)) && summary.html.includes(escaped(statementUiMoney(BigInt(amount), "KWD", { locale, numerals: locale === "fa-IR" ? "arabext" : "latn" }))));
    assert.ok(render("income-statement", ready, locale).html.includes(escaped(t("noData"))));
    for (const currencyCode of ["USD", "JPY", "IRR", "KWD"]) assert.ok(render("income-statement", { ...ready, data: incomeStatementUi({ ...income, currencyCode }) }, locale).html.includes(escaped(statementUiMoney(BigInt(amount), currencyCode, { locale, numerals: locale === "fa-IR" ? "arabext" : "latn" }))));
  }
});

test("executive production JSX localizes every known KPI and period/percent messages, preserving unknown labels and delta signs", () => {
  for (const locale of locales) {
    const t = translator(locale), h = render("executive-summary", { ...ready, ...executiveSummaryUi(executive) }, locale);
    for (const key of ["executiveTitle", "executiveDescription", "executiveHelp", "downloadPdf", "vsLastPeriod", "kpiRevenue", "kpiGrossProfit", "kpiExpenses", "kpiNetIncome", "kpiCash", "kpiReceivable", "kpiPayable"] as const) assert.ok(h.html.includes(escaped(t(key))), key);
    assert.ok(h.html.includes(escaped(t("priorPeriod", { start: "2023-12-01", end: "2023-12-31" }))));
    for (const [sign, value] of [["+", "12.5"], ["", "-2"], ["+", "0"]]) assert.ok(h.html.includes(escaped(t("deltaPercent", { sign, value }))));
    assert.ok(h.html.includes(escaped(caller)) && !h.html.includes("<script>"));
    assert.ok(h.html.includes(`+${escaped(statementUiMoney(BigInt(amount), "KWD", { locale, numerals: locale === "fa-IR" ? "arabext" : "latn" }))}`));
    assert.ok(h.html.includes(`-${escaped(statementUiMoney(1n, "KWD", { locale, numerals: locale === "fa-IR" ? "arabext" : "latn" }))}`));
    assert.ok(h.captured.some(c => c.props.href === "/api/v1/reports/executive-summary?startDate=2024-01-01&endDate=2024-01-31&basis=cash&format=pdf"));
    assert.ok(!h.html.includes("MISSING_MESSAGE"));
  }
});

test("production reads retain date/basis/org contracts and adopt only valid complete report amounts", async () => {
  for (const locale of locales) for (const route of routes) for (const mode of ["ok", "http", "json", "envelope", "amount", "network"]) {
    let calls = 0;
    await withIO(async (url, init) => {
      calls++;
      const expected = route === "income-statement" ? "/api/v1/reports/income-statement?from=2024-01-01&to=2024-12-31" : `/api/v1/reports/${route}?startDate=2024-01-01&endDate=2024-01-31&basis=cash`;
      assert.equal(url, expected); assert.equal((init?.headers as Record<string, string>)["x-organization-id"], "org-a");
      if (mode === "network") throw new Error("private network");
      if (mode === "json") return new Response("private JSON");
      const body = mode === "amount" ? route === "executive-summary" ? { ...executive, kpis: [{ ...executive.kpis[0], currentMinor: "1" }] } : { ...bodies[route], netIncomeMinor: "1" } : bodies[route];
      return Response.json(mode === "envelope" ? {} : mode === "http" ? { error: "private server" } : body, { status: mode === "http" ? 403 : 200 });
    }, async () => {
      const h = render(route, { ...period, year: 2024 }, locale); h.effects[0](); await flush();
      assert.equal(calls, 1); assert.ok(has(h, "loading", false) && has(h, "initialLoad", false));
      assert.ok(has(h, "error", mode !== "ok"));
      const adoption = route === "profit-and-loss" ? "revenue" : route === "income-statement" ? "data" : "currencyCode";
      const adopted = h.events.filter(e => e[0] === adoption);
      assert.equal(adopted.length, mode === "ok" ? 1 : 0);
      if (mode === "ok") {
        const parsed = parsers[route](bodies[route]);
        assert.deepEqual(adopted[0][1], route === "profit-and-loss" ? profitLossUi(pnl).revenue : route === "income-statement" ? parsed : "KWD");
      }
      assert.equal(h.events.some(e => typeof e[1] === "string" && e[1].includes("private")), false);
      if (route === "executive-summary" && mode !== "ok") assert.ok(has(h, "priorPeriod", null) && h.events.some(e => e[0] === "kpis" && Array.isArray(e[1]) && !e[1].length));
    });
  }
});

test("loading, finite failures, retry, date/year/basis callbacks and cleanup preserve report behavior", async () => {
  for (const route of routes) for (const locale of locales) {
    assert.ok(render(route, {}, locale).captured.some(c => c.kind === "BrandLoader"));
    assert.ok(render(route, { initialLoad: false, loading: true }, locale).captured.some(c => c.kind === "BrandLoader"));
    await withIO(async () => { throw new Error("unexpected fetch"); }, async () => {
      const failed = render(route, { ...ready, error: true }, locale);
      assert.ok(failed.html.includes(escaped(translator(locale)("loadFailed"))));
      if (route !== "executive-summary") {
        const before = reloads;
        (failed.captured.find(c => c.kind === "ErrorState")!.props.onRetry as () => void)(); assert.equal(reloads, before + 1);
      }
      const h = render(route, ready, locale);
      if (route === "income-statement") {
        (h.captured.find(c => c.kind === "select")!.props.onChange as (e: unknown) => void)({ target: { value: "2023" } });
        assert.ok(has(h, "year", 2023));
      } else {
        (h.captured.find(c => c.kind === "DateRangeFilter")!.props.onDateChange as (s: string, e: string) => void)("2023-01-01", "2023-12-31");
        assert.ok(has(h, "startDate", "2023-01-01") && has(h, "endDate", "2023-12-31"));
        for (const basis of ["cash", "accrual"]) (h.captured.find(c => c.kind === "BasisToggle")!.props.onChange as (v: string) => void)(basis);
        assert.ok(has(h, "basis", "cash") && has(h, "basis", "accrual"));
      }
    });
    for (const fail of [false, true]) {
      let finish!: (r: Response) => void;
      await withIO(async () => new Promise<Response>(resolve => { finish = resolve; }), async () => {
        const h = render(route); const cleanup = h.effects[0]();
        (cleanup as () => void)(); const before = [...h.events];
        finish(Response.json(fail ? {} : bodies[route])); await flush(); assert.deepEqual(h.events, before);
      });
    }
    await withIO(async () => { throw new Error("orgless fetch"); }, async () => {
      const h = render(route); h.effects[0](); await flush(); assert.deepEqual(h.events, []);
    }, null);
  }
});

test("income report catalogs are paired and authored JSX copy is fully extracted", () => {
  assert.deepEqual(Object.keys(en.IncomeReports), Object.keys(fa.IncomeReports));
  for (const [key, value] of Object.entries(fa.IncomeReports)) if (key !== "deltaPercent") assert.match(value, /[\u0600-\u06ff]/, key);
  for (const route of routes) {
    const file = `app/(dashboard)/reports/${route}/page.tsx`;
    const ast = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    function visit(n: ts.Node) {
      if (ts.isJsxText(n)) assert.doesNotMatch(n.getText(ast), /[A-Za-z]/);
      if (ts.isJsxAttribute(n) && ["title", "description", "aria-label", "emptyMessage"].includes(n.name.getText(ast)) && n.initializer && ts.isStringLiteral(n.initializer)) assert.doesNotMatch(n.initializer.text, /[A-Za-z]/);
      ts.forEachChild(n, visit);
    }
    visit(ast);
  }
});
