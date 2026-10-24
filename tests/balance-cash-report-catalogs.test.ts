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
import { balanceSheetUi, statementComparisonDates, statementComparisonPeriods, statementUiMoney } from "../lib/money/financial-statement-ui";
import { cashFlowUi, reportUiMoney } from "../lib/money/ledger-aging-ui";
import * as DatePicker from "../components/ui/date-picker";
import * as Select from "../components/ui/select";
import { generateCSV } from "../lib/import-export/csv-utils";
import { renderWithPresentation } from "./helpers/presentation";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";

const routes = ["balance-sheet", "comparative-balance-sheet", "cash-flow"] as const;
type Route = typeof routes[number];
const locales = ["en-US", "fa-IR"] as const;
type Locale = typeof locales[number];
const translator = (locale: Locale) => createTranslator({ locale, messages: locale === "en-US" ? en : fa, namespace: "BalanceCashReports" });
const escaped = (v: string) => v.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#x27;");
const caller = "<script>account & label</script>";
const amount = 9007199254740001, alias = String(amount);
const dates = ["2024-03-15", "2024-02-29", "2024-01-31"];
const section = (type: string, value: string, minor: string, name = caller) => ({ type,
  accounts: [{ accountId: type, code: "1000", name, balance: value, balanceMinor: minor,
    balances: [value, "0.00", "0.00"], balancesMinor: [minor, "0", "0"] }],
  total: value, totalMinor: minor, totals: [value, "0.00", "0.00"], totalsMinor: [minor, "0", "0"] });
const balance = { currencyCode: "KWD", asAt: dates[0], dates, compareDates: dates.slice(1),
  assets: section("asset", "90071992547400.01", alias), liabilities: section("liability", "-0.01", "-1"), equity: section("equity", "0.00", "0") };
const cash = { currencyCode: "KWD", startDate: "2024-01-01", endDate: "2024-01-31",
  operating: [{ accountName: caller, accountCode: "4000", amount, amountMinor: alias }], investing: [], financing: [],
  totalOperating: amount, totalOperatingMinor: alias, totalInvesting: 0, totalInvestingMinor: "0", totalFinancing: 0, totalFinancingMinor: "0", netCashFlow: amount, netCashFlowMinor: alias };
const bodies = { "balance-sheet": balance, "comparative-balance-sheet": balance, "cash-flow": cash };
const ready = { initialLoad: false, loading: false, asAt: dates[0], showCompare: true, compareDate: dates[1], startDate: cash.startDate, endDate: cash.endDate };

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
    if (id.endsWith("/date-picker")) return DatePicker;
    if (id.endsWith("/select")) return Select;
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

test("balance pages render bilingual labels and exact comparisons while preserving PDF, ledger and CSV contracts", () => {
  for (const locale of locales) {
    const t = translator(locale), data = balanceSheetUi(balance), periods = statementComparisonPeriods(data);
    const h = render("balance-sheet", { ...ready, data }, locale);
    for (const key of ["balanceTitle", "balanceDescription", "balanceHelp", "downloadPdf", "asOfLabel", "comparingEarlier", "balance_assets", "balance_liabilities", "balance_equity", "balanceTotal_assets", "balanceTotal_liabilities", "balanceTotal_equity", "code", "account"] as const) assert.ok(h.html.includes(escaped(t(key))), key);
    for (const date of dates) assert.ok(h.html.includes(escaped(t("asOfDate", { date }))));
    assert.ok(h.html.includes(escaped(caller)) && !h.html.includes("<script>"));
    assert.ok(h.html.includes(escaped(statementUiMoney(BigInt(alias), "KWD", { locale, numerals: locale === "fa-IR" ? "arabext" : "latn" }))));
    assert.ok(h.html.includes(escaped(statementUiMoney(-1n, "KWD", { locale, numerals: locale === "fa-IR" ? "arabext" : "latn" }))));
    assert.ok(h.captured.some(c => c.props.href === "/api/v1/reports/balance-sheet?asAt=2024-03-15&format=pdf&compareDate=2024-02-29"));
    assert.ok(h.captured.some(c => c.props.href === "/reports/general-ledger?endDate=2024-03-15#asset"));
    assert.equal(h.captured.filter(c => c.kind === "DatePicker")[1].props.placeholder, t("earlierDate"));
    const single = render("balance-sheet", { ...ready, showCompare: false, data }, locale);
    assert.ok(single.html.includes(escaped(t("compareEarlier"))));
    assert.ok(single.captured.some(c => c.props.href === "/api/v1/reports/balance-sheet?asAt=2024-03-15&format=pdf"));
    const comparison = render("comparative-balance-sheet", { ...ready, periods }, locale);
    for (const key of ["comparativeTitle", "comparativeDescription", "account", "change", "current", "section_Assets", "section_Liabilities", "section_Equity", "sectionTotal_Assets", "sectionTotal_Liabilities", "sectionTotal_Equity"] as const) assert.ok(comparison.html.includes(escaped(t(key))), key);
    assert.ok(comparison.html.includes(`+${escaped(statementUiMoney(BigInt(alias), "KWD", { locale, numerals: locale === "fa-IR" ? "arabext" : "latn" }))}`));
    assert.ok(comparison.html.includes(escaped(statementUiMoney(-1n, "KWD", { locale, numerals: locale === "fa-IR" ? "arabext" : "latn" }))));
    assert.ok(comparison.html.includes("Jan 2024") && comparison.html.includes("Feb 2024"));
    const exported = comparison.captured.find(c => c.kind === "ExportButton")!.props;
    assert.equal(exported.filename, "comparative-balance-sheet");
    assert.deepEqual(exported.columns, ["section", "code", "name", "currencyCode", "Jan 2024Minor", "Feb 2024Minor", "CurrentMinor"]);
    const rows = exported.data as Record<string, unknown>[];
    assert.deepEqual(rows.map(row => row.section), ["Assets", "Liabilities", "Equity"]);
    assert.equal(rows[0].CurrentMinor, alias); assert.equal(rows[1].CurrentMinor, "-1");
    assert.ok(generateCSV(rows, exported.columns as string[]).includes(alias));
    assert.ok(render("comparative-balance-sheet", ready, locale).html.includes(escaped(t("noBalanceData"))));
    const options = comparison.captured.filter(c => c.kind === "SelectItem");
    assert.deepEqual(options.map(c => c.props.value), ["2", "3", "4", "6"]);
    for (const option of options) assert.equal(option.props.children, t("periodCount", { count: Number(option.props.value) }));
    assert.ok(comparison.captured.some(c => c.props["aria-label"] === t("periodCountLabel")));
    for (const currencyCode of ["USD", "JPY", "IRR", "KWD"]) assert.ok(render("balance-sheet", { ...ready, data: balanceSheetUi({ ...balance, currencyCode }) }, locale).html.includes(escaped(statementUiMoney(BigInt(alias), currencyCode, { locale, numerals: locale === "fa-IR" ? "arabext" : "latn" }))));
  }
});

test("cash-flow production JSX renders all section help, complete totals and empty states without changing amounts", () => {
  for (const locale of locales) {
    const t = translator(locale), data = cashFlowUi(cash);
    const h = render("cash-flow", { ...ready, data }, locale);
    for (const key of ["cashTitle", "cashDescription", "cashHelp", "cash_operating", "cash_investing", "cash_financing", "cashHelp_operating", "cashHelp_investing", "cashHelp_financing", "cashTotal_operating", "cashTotal_investing", "cashTotal_financing", "cashEmpty_investing", "cashEmpty_financing", "changeInCash", "totalCashChange", "code", "account", "amount"] as const) assert.ok(h.html.includes(escaped(t(key))), key);
    assert.ok(h.html.includes(escaped(caller)) && !h.html.includes("<script>"));
    assert.ok(h.html.includes(escaped(reportUiMoney(BigInt(alias), "KWD", { locale, numerals: locale === "fa-IR" ? "arabext" : "latn" }))));
    assert.ok(render("cash-flow", ready, locale).html.includes(escaped(t("cashEmpty_operating"))));
    const tables = h.captured.filter(c => c.kind === "DataTable");
    assert.deepEqual((tables[0].props.columns as { key: string }[]).map(c => c.key), ["code", "name", "amount"]);
    for (const currencyCode of ["USD", "JPY", "IRR", "KWD"]) assert.ok(render("cash-flow", { ...ready, data: cashFlowUi({ ...cash, currencyCode }) }, locale).html.includes(escaped(reportUiMoney(BigInt(alias), currencyCode, { locale, numerals: locale === "fa-IR" ? "arabext" : "latn" }))));
    const negative = cashFlowUi({ ...cash, operating: [{ ...cash.operating[0], amount: -1, amountMinor: "-1" }], totalOperating: -1, totalOperatingMinor: "-1", netCashFlow: -1, netCashFlowMinor: "-1" });
    assert.ok(render("cash-flow", { ...ready, data: negative }, locale).html.includes(escaped(reportUiMoney(-1n, "KWD", { locale, numerals: locale === "fa-IR" ? "arabext" : "latn" }))));
  }
});

test("report effects preserve date/org requests and reject malformed reads before any data adoption", async () => {
  for (const locale of locales) for (const route of routes) for (const mode of ["ok", "http", "json", "envelope", "amount", "network"]) {
    let calls = 0;
    await withIO(async (url, init) => {
      calls++;
      if (route === "cash-flow") assert.equal(url, "/api/v1/reports/cash-flow?startDate=2024-01-01&endDate=2024-01-31");
      else {
        const parsed = new URL(String(url), "https://local.test");
        assert.equal(parsed.pathname, "/api/v1/reports/balance-sheet");
        if (route === "balance-sheet") {
          assert.equal(parsed.searchParams.get("asAt"), dates[0]);
          assert.deepEqual(parsed.searchParams.getAll("compareDate"), [dates[1]]);
        } else {
          const expected = statementComparisonDates(new Date().toISOString().slice(0, 10), 3);
          assert.equal(parsed.searchParams.get("asAt"), expected[0]);
          assert.deepEqual(parsed.searchParams.getAll("compareDate"), expected.slice(1));
        }
      }
      assert.equal((init?.headers as Record<string, string>)["x-organization-id"], "org-a");
      if (mode === "network") throw new Error("private network");
      if (mode === "json") return new Response("private JSON");
      const body = mode === "amount" ? route === "cash-flow" ? { ...cash, netCashFlowMinor: "1" } : { ...balance, assets: { ...balance.assets, totalMinor: "1" } } : bodies[route];
      return Response.json(mode === "envelope" ? {} : mode === "http" ? { error: "private server" } : body, { status: mode === "http" ? 403 : 200 });
    }, async () => {
      const h = render(route, ready, locale); h.effects[0](); await flush();
      assert.equal(calls, 1); assert.ok(has(h, "loading", false) && has(h, "initialLoad", false));
      assert.ok(has(h, "error", false));
      assert.equal(has(h, "error", true), mode !== "ok");
      const adopted = h.events.filter(e => e[0] === (route === "comparative-balance-sheet" ? "periods" : "data"));
      assert.equal(adopted.length, mode === "ok" ? 1 : 0);
      if (mode === "ok") assert.deepEqual(adopted[0][1], route === "cash-flow" ? cashFlowUi(cash) : route === "balance-sheet" ? balanceSheetUi(balance) : statementComparisonPeriods(balanceSheetUi(balance)));
      assert.equal(h.events.some(e => typeof e[1] === "string" && e[1].includes("private")), false);
    });
  }
});

test("loading, safe failures, retry, date/period callbacks and obsolete-request cleanup retain behavior", async () => {
  for (const route of routes) for (const locale of locales) {
    assert.ok(render(route, {}, locale).captured.some(c => c.kind === "BrandLoader"));
    assert.ok(render(route, { ...ready, loading: true }, locale).captured.some(c => c.kind === "BrandLoader"));
    await withIO(async () => { throw new Error("unexpected fetch"); }, async () => {
      const failed = render(route, { ...ready, error: true }, locale);
      assert.ok(failed.html.includes(escaped(translator(locale)("loadFailed"))));
      const before = reloads;
      (failed.captured.find(c => c.kind === "ErrorState")!.props.onRetry as () => void)(); assert.equal(reloads, before + 1);
      const h = render(route, ready, locale);
      if (route === "cash-flow") {
        (h.captured.find(c => c.kind === "DateRangeFilter")!.props.onDateChange as (s: string, e: string) => void)("2023-01-01", "2023-12-31");
        assert.ok(has(h, "startDate", "2023-01-01") && has(h, "endDate", "2023-12-31"));
      } else if (route === "balance-sheet") {
        const pickers = h.captured.filter(c => c.kind === "DatePicker");
        (pickers[0].props.onChange as (date: string) => void)("2023-12-31");
        (pickers[1].props.onChange as (date: string) => void)("2023-11-30");
        assert.ok(has(h, "asAt", "2023-12-31") && has(h, "compareDate", "2023-11-30"));
        const toggle = h.captured.find(c => typeof c.props.onClick === "function")!;
        (toggle.props.onClick as () => void)();
        const update = h.events.find(e => e[0] === "showCompare")![1] as (v: boolean) => boolean;
        assert.equal(update(false), true); assert.equal(update(true), false);
      } else {
        for (const value of ["2", "3", "4", "6"]) (h.captured.find(c => typeof c.props.onValueChange === "function")!.props.onValueChange as (value: string) => void)(value);
        assert.deepEqual(h.events.filter(e => e[0] === "compareMonths").map(e => e[1]), [2, 3, 4, 6]);
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

test("balance/cash catalogs are paired, Persian script is intact and authored JSX copy is extracted", () => {
  assert.deepEqual(Object.keys(en.BalanceCashReports), Object.keys(fa.BalanceCashReports));
  for (const [key, value] of Object.entries(fa.BalanceCashReports)) assert.match(value, /[\u0600-\u06ff]/, key);
  for (const route of routes) {
    const file = `app/(dashboard)/reports/${route}/page.tsx`;
    const ast = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    function visit(n: ts.Node) {
      if (ts.isJsxText(n)) assert.doesNotMatch(n.getText(ast), /[A-Za-z]/);
      if (ts.isJsxAttribute(n) && ["title", "description", "placeholder", "aria-label", "emptyMessage"].includes(n.name.getText(ast)) && n.initializer && ts.isStringLiteral(n.initializer)) assert.doesNotMatch(n.initializer.text, /[A-Za-z]/);
      ts.forEachChild(n, visit);
    }
    visit(ast);
  }
});
