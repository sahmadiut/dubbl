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
import * as DatePicker from "../components/ui/date-picker";
import { trialBalanceUi, trialBalanceTotals, statementUiMoney } from "../lib/money/financial-statement-ui";
import { generalLedgerUi, ledgerPageUi, appendLedgerPage, reportUiMoney } from "../lib/money/ledger-aging-ui";
import { generateCSV } from "../lib/import-export/csv-utils";
import { renderWithPresentation } from "./helpers/presentation";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";

const routes = ["trial-balance", "general-ledger"] as const;
type Route = typeof routes[number];
const locales = ["en-US", "fa-IR"] as const;
type Locale = typeof locales[number];
const translator = (locale: Locale) => createTranslator({ locale, messages: locale === "en-US" ? en : fa, namespace: "LedgerReports" });
const escaped = (v: string) => v.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#x27;");
const caller = "<script>account & label</script>";
const large = 9007199254740001n;
const pair = (key: string, value: bigint) => ({ [key]: Number(value), [`${key}Minor`]: String(value) });
const dates = ["2024-03-15", "2024-02-29"];
const split = { balance: "90071992547400.01", balanceMinor: String(large), debitBalance: "90071992547400.01", debitBalanceMinor: String(large), creditBalance: "0.00", creditBalanceMinor: "0" };
const prior = { balance: "-0.01", balanceMinor: "-1", debitBalance: "0.00", debitBalanceMinor: "0", creditBalance: "0.01", creditBalanceMinor: "1" };
const trial = { currencyCode: "KWD", asAt: dates[0], dates, compareDates: dates.slice(1), accounts: [{ accountId: "cash", code: "1000", name: caller, type: "asset", ...split, balances: [split, prior] }] };
const entry = { date: "2024-01-10", entryNumber: 1, entryId: "first", lineId: "line-one", description: caller, reference: null,
  ...pair("debit", large), ...pair("credit", 0n), ...pair("runningBalance", large), ...pair("ledgerBalance", large + 101n) };
const ledger = { currencyCode: "KWD", startDate: "2024-01-01", endDate: "2024-01-31", accounts: [{ accountId: "cash", accountName: caller, accountCode: "1000", accountType: "asset", totalEntries: 2,
  ...pair("totalDebit", large), ...pair("totalCredit", 901n), ...pair("balance", large - 901n), ...pair("openingBalance", 101n), ...pair("closingLedgerBalance", large - 800n), entries: [entry] }] };
const page = { ...ledger.accounts[0], ...ledger, accounts: undefined, offset: 1, limit: 200, entries: [{ ...entry, date: "2024-01-20", entryNumber: 2, entryId: "second", lineId: "line-two", description: "Payment", reference: "Ref",
  ...pair("debit", 0n), ...pair("credit", 901n), ...pair("runningBalance", large - 901n), ...pair("ledgerBalance", large - 800n) }] };
const bodies = { "trial-balance": trial, "general-ledger": ledger };
const ready = { initialLoad: false, loading: false, asAt: dates[0], showCompare: true, compareDate: dates[1], startDate: ledger.startDate, endDate: ledger.endDate, expandedAccounts: new Set(["cash"]) };

type Capture = { kind: string; props: Record<string, unknown> };
type Harness = { html: string; captured: Capture[]; effects: (() => void | (() => void))[]; events: [string, unknown][]; refs: Record<string, { current: unknown }> };

// Render production JSX/readers and real shared UI under PresentationProvider.
// Only page hook state, IO and animation are controlled by this harness.
function render(route: Route, states: Record<string, unknown> = {}, locale: Locale = "en-US"): Harness {
  const file = `app/(dashboard)/reports/${route}/page.tsx`;
  const ast = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const names: string[] = [], refNames: string[] = [];
  function hooks(n: ts.Node) {
    if (ts.isVariableDeclaration(n) && n.initializer && ts.isCallExpression(n.initializer)) {
      if (ts.isArrayBindingPattern(n.name) && n.initializer.expression.getText(ast) === "useState") names.push(n.name.elements[0].getText(ast));
      if (n.initializer.expression.getText(ast) === "useRef") refNames.push(n.name.getText(ast));
    }
    ts.forEachChild(n, hooks);
  }
  hooks(ast);
  const h: Harness = { html: "", captured: [], effects: [], events: [], refs: {} };
  const capture = (factory: typeof jsx.jsx) => (kind: unknown, props: Record<string, unknown>, key: string) => {
    h.captured.push({ kind: typeof kind === "string" ? kind : (kind as { name?: string })?.name ?? "", props });
    return factory(kind as Parameters<typeof jsx.jsx>[0], props, key);
  };
  let index = 0, refIndex = 0;
  const require = createRequire(resolve(file)), compiled = { exports: {} as { default: ComponentType } };
  const load = (id: string): unknown => {
    if (id === "react") return { ...React, useState: (initial: unknown) => {
      const key = names[index++];
      const value = Object.hasOwn(states, key) ? states[key] : typeof initial === "function" ? initial() : initial;
      return [value, (v: unknown) => h.events.push([key, v])];
    }, useEffect: (fn: () => void | (() => void)) => h.effects.push(fn), useRef: (initial: unknown) => {
      const ref = { current: initial }; h.refs[refNames[refIndex++]] = ref; return ref;
    } };
    if (id === "react/jsx-runtime") return { ...jsx, jsx: capture(jsx.jsx), jsxs: capture(jsx.jsxs) };
    if (id === "next-intl") return nextIntl;
    if (id.endsWith("/brand-loader")) return BrandLoader;
    if (id === "../_components") return ReportComponents;
    if (id.endsWith("/date-range-filter")) return DateRangeFilter;
    if (id.endsWith("/error-state")) return ErrorState;
    if (id.endsWith("/data-table")) return DataTable;
    if (id.endsWith("/export-button")) return ExportButton;
    if (id.endsWith("/date-picker")) return DatePicker;
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
let reloads = 0;
async function withIO(fetcher: typeof fetch, run: () => Promise<void>, org: string | null = "org-a", search = "", hash = "") {
  const original = globalThis.fetch, storage = Object.getOwnPropertyDescriptor(globalThis, "localStorage"), window = Object.getOwnPropertyDescriptor(globalThis, "window");
  globalThis.fetch = fetcher;
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: (key: string) => { assert.equal(key, "activeOrgId"); return org; } } });
  Object.defineProperty(globalThis, "window", { configurable: true, value: { location: { search, hash, reload() { reloads++; } } } });
  try { await run(); } finally {
    globalThis.fetch = original;
    if (storage) Object.defineProperty(globalThis, "localStorage", storage); else Reflect.deleteProperty(globalThis, "localStorage");
    if (window) Object.defineProperty(globalThis, "window", window); else Reflect.deleteProperty(globalThis, "window");
  }
}

test("trial production JSX localizes comparisons and types while preserving exact totals, links and CSV", () => {
  for (const locale of locales) {
    const t = translator(locale), ta = createTranslator({ locale, messages: locale === "en-US" ? en : fa, namespace: "Accounts" });
    const data = trialBalanceUi(trial), h = render("trial-balance", { ...ready, data }, locale);
    for (const key of ["trialTitle", "trialDescription", "trialHelp", "asOfLabel", "comparingEarlier", "code", "account", "type", "moneyInSide", "moneyOutSide", "total"] as const) assert.ok(h.html.includes(escaped(t(key))), key);
    for (const date of dates) assert.ok(h.html.includes(escaped(t("asOfDate", { date }))));
    assert.ok(h.html.includes(escaped(caller)) && !h.html.includes("<script>"));
    assert.ok(h.html.includes(escaped(ta("asset"))));
    for (const total of trialBalanceTotals(data)) for (const value of [total.debit, total.credit]) assert.ok(h.html.includes(escaped(statementUiMoney(value, "KWD", { locale, numerals: locale === "fa-IR" ? "arabext" : "latn" }))));
    assert.ok(h.captured.some(c => c.props.href === "/reports/general-ledger?endDate=2024-03-15#cash"));
    assert.equal(h.captured.filter(c => c.kind === "DatePicker")[1].props.placeholder, t("earlierDate"));
    const single = render("trial-balance", { ...ready, showCompare: false, data: trialBalanceUi({ ...trial, dates: undefined, compareDates: undefined, accounts: [{ ...trial.accounts[0], balances: undefined }] }) }, locale);
    assert.ok(single.html.includes(escaped(t("compareEarlier"))));
    const exported = h.captured.find(c => c.kind === "ExportButton")!.props;
    assert.equal(exported.filename, "account-balances");
    assert.deepEqual(exported.columns, ["code", "name", "type", "currencyCode", "debitBalanceMinor", "creditBalanceMinor"]);
    const rows = exported.data as Record<string, unknown>[];
    assert.equal(rows[0].type, "asset"); assert.equal(rows[0].debitBalanceMinor, String(large)); assert.equal(rows[0].name, caller);
    assert.ok(generateCSV(rows, exported.columns as string[]).includes(String(large)));
    for (const currencyCode of ["USD", "JPY", "IRR", "KWD"]) assert.ok(render("trial-balance", { ...ready, data: trialBalanceUi({ ...trial, currencyCode }) }, locale).html.includes(escaped(statementUiMoney(large, currencyCode, { locale, numerals: locale === "fa-IR" ? "arabext" : "latn" }))));
    for (const type of ["asset", "liability", "equity", "revenue", "expense", "caller-type"]) {
      const typed = render("trial-balance", { ...ready, data: trialBalanceUi({ ...trial, accounts: [{ ...trial.accounts[0], type }] }) }, locale);
      assert.ok(typed.html.includes(type === "caller-type" ? type : escaped(ta(type as "asset"))));
    }
  }
});

test("ledger JSX translates complete filters, counts, labels and paging while preserving entry data and CSV", () => {
  for (const locale of locales) {
    const t = translator(locale), data = generalLedgerUi(ledger);
    const h = render("general-ledger", { ...ready, data, dimension: { projectId: "project" } }, locale);
    for (const key of ["ledgerTitle", "ledgerDescription", "ledgerHelp", "date", "entryNumber", "description", "reference", "debit", "credit", "runningBalance", "projectFilter", "showAll", "expandAll", "collapseAll"] as const) assert.ok(h.html.includes(escaped(t(key))), key);
    assert.ok(h.html.includes(escaped(t("summary", { accounts: 1, entries: 2 }))));
    assert.ok(h.html.includes(escaped(t("loadMore", { loaded: 1, total: 2 }))));
    for (const [key, value] of [["inAmount", data.accounts[0].totalDebit], ["outAmount", data.accounts[0].totalCredit], ["balanceAmount", data.accounts[0].balance]] as const) assert.ok(h.html.includes(escaped(t(key, { amount: reportUiMoney(value, "KWD", { locale, numerals: locale === "fa-IR" ? "arabext" : "latn" }) }))));
    assert.ok(h.html.includes(escaped(caller)) && !h.html.includes("<script>"));
    assert.ok(h.html.includes("Jan 10")); // Existing date-presentation exception.
    assert.ok(h.captured.some(c => c.props.id === "gl-cash"));
    assert.ok(h.captured.some(c => c.props.href === "/reports/general-ledger"));
    const table = h.captured.find(c => c.kind === "DataTable")!.props;
    assert.deepEqual((table.columns as { key: string }[]).map(c => c.key), ["date", "entry", "desc", "ref", "debit", "credit", "balance"]);
    const exported = h.captured.find(c => c.kind === "ExportButton")!.props;
    assert.equal(exported.filename, "general-ledger");
    assert.deepEqual(exported.columns, ["account", "accountName", "date", "entryNumber", "description", "reference", "currencyCode", "debitMinor", "creditMinor", "runningBalanceMinor", "ledgerBalanceMinor"]);
    const rows = exported.data as Record<string, unknown>[];
    assert.equal(rows[0].debitMinor, String(large)); assert.equal(rows[0].ledgerBalanceMinor, String(large + 101n));
    assert.ok(generateCSV(rows, exported.columns as string[]).includes(String(large + 101n)));
    assert.ok(render("general-ledger", { ...ready, data, dimension: { costCenterId: "department" } }, locale).html.includes(escaped(t("departmentFilter"))));
    const empty = render("general-ledger", ready, locale);
    for (const key of ["noEntriesTitle", "noEntriesDescription"] as const) assert.ok(empty.html.includes(escaped(t(key))));
    const noLines = generalLedgerUi({ ...ledger, accounts: [{ ...ledger.accounts[0], totalEntries: 0, ...pair("totalDebit", 0n), ...pair("totalCredit", 0n), ...pair("balance", 0n), ...pair("closingLedgerBalance", 101n), entries: [] }] });
    assert.ok(render("general-ledger", { ...ready, data: noLines }, locale).html.includes(escaped(t("noEntries"))));
    const loading = render("general-ledger", { ...ready, data, loadingMore: new Set(["cash"]) }, locale);
    assert.ok(loading.html.includes(escaped(t("loading"))));
    assert.equal(loading.captured.find(c => c.props.children === t("loading"))!.props.disabled, true);
    const singular = render("general-ledger", { ...ready, data: generalLedgerUi({ ...ledger, accounts: [{ ...ledger.accounts[0], totalEntries: 1, ...pair("totalCredit", 0n), ...pair("balance", large), ...pair("closingLedgerBalance", large + 101n) }] }) }, locale);
    assert.ok(singular.html.includes(escaped(t("summary", { accounts: 1, entries: 1 }))));
    const multiple = generalLedgerUi({ ...ledger, accounts: [ledger.accounts[0], { ...ledger.accounts[0], accountId: "other" }] });
    assert.ok(render("general-ledger", { ...ready, data: multiple }, locale).html.includes(escaped(t("summary", { accounts: 2, entries: 4 }))));
    for (const currencyCode of ["USD", "JPY", "IRR", "KWD"]) assert.ok(render("general-ledger", { ...ready, data: generalLedgerUi({ ...ledger, currencyCode }) }, locale).html.includes(escaped(reportUiMoney(large, currencyCode, { locale, numerals: locale === "fa-IR" ? "arabext" : "latn" }))));
    const negative = generalLedgerUi({ ...ledger, accounts: [{ ...ledger.accounts[0], accountType: "revenue", ...pair("balance", -large + 901n), ...pair("openingBalance", -101n), ...pair("closingLedgerBalance", -large + 800n), entries: [{ ...entry, ...pair("runningBalance", -large), ...pair("ledgerBalance", -large - 101n) }] }] });
    assert.ok(render("general-ledger", { ...ready, data: negative }, locale).html.includes(escaped(reportUiMoney(-large, "KWD", { locale, numerals: locale === "fa-IR" ? "arabext" : "latn" }))));
  }
});

test("initial effects preserve date/org/dimension requests and reject failed reads before adoption", async () => {
  for (const locale of locales) for (const route of routes) for (const mode of ["ok", "http", "json", "envelope", "amount", "network"]) {
    let calls = 0;
    await withIO(async (url, init) => {
      calls++;
      const parsed = new URL(String(url), "https://local.test"); assert.equal(parsed.pathname, `/api/v1/reports/${route}`);
      assert.deepEqual(Object.fromEntries(parsed.searchParams), route === "trial-balance" ? { asAt: dates[0], compareDate: dates[1] } : { startDate: ledger.startDate, endDate: ledger.endDate, projectId: "project" });
      assert.equal((init?.headers as Record<string, string>)["x-organization-id"], "org-a");
      if (mode === "network") throw new Error("private network");
      if (mode === "json") return new Response("private JSON");
      const body = mode === "amount" ? route === "trial-balance" ? { ...trial, accounts: [{ ...trial.accounts[0], balanceMinor: "1" }] } : { ...ledger, accounts: [{ ...ledger.accounts[0], totalDebitMinor: "1" }] } : bodies[route];
      return Response.json(mode === "envelope" ? {} : mode === "http" ? { error: "private server" } : body, { status: mode === "http" ? 403 : 200 });
    }, async () => {
      const h = render(route, { ...ready, dimension: { projectId: "project" } }, locale); h.effects[0](); await flush();
      assert.equal(calls, 1); assert.ok(has(h, "loading", false) && has(h, "initialLoad", false));
      assert.ok(has(h, "error", false)); assert.equal(has(h, "error", true), mode !== "ok");
      const adopted = h.events.filter(e => e[0] === "data"); assert.equal(adopted.length, mode === "ok" ? 1 : 0);
      if (mode === "ok") assert.deepEqual(adopted[0][1], route === "trial-balance" ? trialBalanceUi(trial) : generalLedgerUi(ledger));
      assert.equal(h.events.some(e => typeof e[1] === "string" && e[1].includes("private")), false);
    });
  }
});

test("ledger load-more preserves snapshot checks, exact append, safe errors, and obsolete-request guards", async () => {
  for (const locale of locales) for (const mode of ["ok", "http", "json", "amount", "snapshot", "network", "obsolete"]) {
    let calls = 0;
    await withIO(async (url, init) => {
      calls++;
      assert.equal(url, "/api/v1/reports/general-ledger?startDate=2024-01-01&endDate=2024-01-31&accountId=cash&offset=1&limit=200&projectId=project");
      assert.equal((init?.headers as Record<string, string>)["x-organization-id"], "org-a");
      if (mode === "network") throw new Error("private network");
      if (mode === "json") return new Response("private JSON");
      return Response.json(mode === "http" ? { error: "private server" } : { ...page, dimension: "projectId", dimensionValue: "project", ...(mode === "amount" ? { totalDebitMinor: "1" } : mode === "snapshot" ? { offset: 0 } : {}) }, { status: mode === "http" ? 403 : 200 });
    }, async () => {
      const data = generalLedgerUi({ ...ledger, dimension: "projectId", dimensionValue: "project" });
      const h = render("general-ledger", { ...ready, data, dimension: { projectId: "project" } }, locale);
      h.refs.reportRef.current = data;
      const button = h.captured.find(c => c.props.children === translator(locale)("loadMore", { loaded: 1, total: 2 }))!;
      const pending = (button.props.onClick as () => Promise<void>)();
      if (mode === "obsolete") h.refs.requestVersion.current = 1;
      await pending;
      assert.equal(calls, 1);
      assert.equal(has(h, "error", true), !["ok", "obsolete"].includes(mode));
      const adopted = h.events.filter(e => e[0] === "data"); assert.equal(adopted.length, mode === "ok" ? 1 : 0);
      if (mode === "ok") assert.deepEqual(adopted[0][1], appendLedgerPage(data, "cash", ledgerPageUi({ ...page, dimension: "projectId", dimensionValue: "project" })));
      assert.equal(h.events.filter(e => e[0] === "loadingMore").length, mode === "obsolete" ? 1 : 2);
      assert.equal(h.events.some(e => typeof e[1] === "string" && e[1].includes("private")), false);
    });
  }
});

test("loading, retry, date/expand callbacks, drilldown priority and effect cleanup retain behavior", async () => {
  for (const locale of locales) for (const route of routes) {
    assert.ok(render(route, {}, locale).captured.some(c => c.kind === "BrandLoader"));
    assert.ok(render(route, { ...ready, loading: true }, locale).captured.some(c => c.kind === "BrandLoader"));
    await withIO(async () => { throw new Error("unexpected fetch"); }, async () => {
      const failed = render(route, { ...ready, error: true }, locale);
      assert.ok(failed.html.includes(escaped(translator(locale)("loadFailed"))));
      const before = reloads; (failed.captured.find(c => c.kind === "ErrorState")!.props.onRetry as () => void)(); assert.equal(reloads, before + 1);
      const h = render(route, { ...ready, data: route === "trial-balance" ? trialBalanceUi(trial) : generalLedgerUi(ledger) }, locale);
      if (route === "trial-balance") {
        const pickers = h.captured.filter(c => c.kind === "DatePicker");
        (pickers[0].props.onChange as (date: string) => void)("2023-12-31"); (pickers[1].props.onChange as (date: string) => void)("2023-11-30");
        assert.ok(has(h, "asAt", "2023-12-31") && has(h, "compareDate", "2023-11-30"));
        (h.captured.find(c => typeof c.props.onClick === "function")!.props.onClick as () => void)();
        const update = h.events.find(e => e[0] === "showCompare")![1] as (v: boolean) => boolean;
        assert.equal(update(false), true); assert.equal(update(true), false);
      } else {
        (h.captured.find(c => c.kind === "DateRangeFilter")!.props.onDateChange as (s: string, e: string) => void)("2023-01-01", "2023-12-31");
        assert.ok(has(h, "startDate", "2023-01-01") && has(h, "endDate", "2023-12-31"));
        for (const key of ["expandAll", "collapseAll"] as const) (h.captured.find(c => c.props.children === translator(locale)(key))!.props.onClick as () => void)();
        assert.deepEqual(h.events.filter(e => e[0] === "expandedAccounts").map(e => e[1]), [new Set(["cash"]), new Set()]);
        (h.captured.find(c => c.kind === "button" && typeof c.props.onClick === "function")!.props.onClick as () => void)();
        const update = h.events.filter(e => e[0] === "expandedAccounts").at(-1)![1] as (v: Set<string>) => Set<string>;
        assert.deepEqual(update(new Set()), new Set(["cash"])); assert.deepEqual(update(new Set(["cash"])), new Set());
      }
    });
    for (const fail of [false, true]) {
      let finish!: (r: Response) => void;
      await withIO(async () => new Promise<Response>(resolve => { finish = resolve; }), async () => {
        const h = render(route); const cleanup = h.effects[0](); (cleanup as () => void)(); const before = [...h.events];
        finish(Response.json(fail ? {} : bodies[route])); await flush(); assert.deepEqual(h.events, before);
      });
    }
    await withIO(async () => { throw new Error("orgless fetch"); }, async () => { const h = render(route); h.effects[0](); await flush(); assert.deepEqual(h.events, []); }, null);
  }
  await withIO(async () => { throw new Error("unexpected fetch"); }, async () => {
    // The lazy initializer preserves canonical date hints and cost-center precedence.
    const h = render("general-ledger", { initialLoad: false, loading: false });
    const filter = h.captured.find(c => c.kind === "DateRangeFilter")!.props;
    assert.equal(filter.startDate, "2023-02-01"); assert.equal(filter.endDate, "2023-02-28");
    assert.ok(h.html.includes(escaped(translator("en-US")("departmentFilter"))));
  }, "org-a", "?startDate=2023-02-01&endDate=2023-02-28&projectId=p&costCenterId=c", "#cash");
});

test("ledger catalogs are paired, Persian text is intact, and authored JSX copy is extracted", () => {
  assert.deepEqual(Object.keys(en.LedgerReports), Object.keys(fa.LedgerReports));
  for (const [key, value] of Object.entries(fa.LedgerReports)) assert.match(value, /[\u0600-\u06ff]/, key);
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
