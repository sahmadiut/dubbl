import { catalogText, visibleText } from "./helpers/catalog-text";
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { createElement, type ComponentType, type ReactElement, type ReactNode } from "react";
import * as React from "react";
import * as nextIntl from "next-intl";
import { createTranslator } from "next-intl";
import ts from "typescript";
import * as BrandLoader from "../components/dashboard/brand-loader";
import * as ExportButton from "../components/dashboard/export-button";
import * as DateRangeFilter from "../components/dashboard/date-range-filter";
import { taxUiMoney } from "../lib/money/tax-ui";
import { basFieldLabelKey, scheduleCLineLabelKey } from "../lib/i18n/tax-filing-presentation";
import { renderWithPresentation } from "./helpers/presentation";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";

const locales = ["en-US", "fa-IR"] as const;
type Locale = typeof locales[number];
const caller = '<script>شرح & reference</script>';
const copyMarkup = (html: string) => html + visibleText(html);
const escape = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#x27;");
const basIds = ["G1", "G2", "G3", "G10", "G11", "1A", "1B", "NET"];
const scheduleIds = ["1", "2", "8", "9", "10", "13", "15", "16a", "16b", "17", "18", "20a", "20b", "21", "22", "23", "24a", "24b", "25", "26", "27"];
const basRows = basIds.map(field => ({ field, label: `wire-${field}`, amount: 1250n }));
const scheduleRows = scheduleIds.map(line => ({ line, label: `wire-${line}`, amount: line === "8" ? 0n : 1250n }));
const salesRows = [{ taxRateName: caller, taxRatePercent: 1450, taxableAmount: 1250n, taxCollected: 1250n, invoiceCount: 1 }, { taxRateName: null, taxRatePercent: null, taxableAmount: 0n, taxCollected: 0n, invoiceCount: 2 }];
const specs = [
  { route: "bas", component: "BasPageWorkspace", namespace: "BasReport", currencyIndex: 4, errorIndex: 5, loadingIndex: 3, rows: basRows,
    state: ["2026-01-01", "2026-03-31", basRows, false, "USD", null], columns: ["field", "description", "amount", "currencyCode"],
    response: { fields: [{ field: "G1", label: caller, amount: 1250, amountMinor: "1250" }] } },
  { route: "sales-tax", component: "SalesTaxPageWorkspace", namespace: "SalesTaxReport", currencyIndex: 5, errorIndex: 6, loadingIndex: 4, rows: salesRows,
    state: ["2026-01-01", "2026-03-31", salesRows, 250n, false, "USD", null], columns: ["taxRate", "ratePercent", "taxableAmount", "taxCollected", "invoiceCount", "currencyCode"],
    response: { breakdown: [{ taxRateName: caller, taxRatePercent: 1450, taxableAmount: 1250, taxableAmountMinor: "1250", taxCollected: 1250, taxCollectedMinor: "1250", invoiceCount: 1 }], exemptAmount: 250, exemptAmountMinor: "250" } },
  { route: "schedule-c", component: "ScheduleCPageWorkspace", namespace: "ScheduleCReport", currencyIndex: 7, errorIndex: 8, loadingIndex: 6, rows: scheduleRows,
    state: ["2026-01-01", "2026-03-31", scheduleRows, 2500n, 1250n, 1250n, false, "USD", null], columns: ["line", "description", "amount", "currencyCode"],
    response: { lines: [{ line: "1", label: caller, amount: 1250, amountMinor: "1250" }], totalIncome: 2500, totalIncomeMinor: "2500", totalExpenses: 1250, totalExpensesMinor: "1250", netProfit: 1250, netProfitMinor: "1250" } },
] as const;
type Spec = typeof specs[number];
const translator = (spec: Spec, locale: Locale) => createTranslator({ locale, messages: catalogText(locale === "en-US" ? en : fa), namespace: spec.namespace });
const states = (spec: Spec, patch: Record<number, unknown> = {}) => Object.assign([...spec.state], patch);
type Tree = ReactElement<Record<string, unknown>>;
function nodes(node: ReactNode): Tree[] {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(nodes);
  const el = node as Tree;
  return el.props ? [el, ...nodes(el.props.children as ReactNode)] : [];
}

// Execute production templates/effects with controlled own hooks and IO. Shared
// controls and next-intl are real during SSR through PresentationProvider.
function loaded(spec: Spec, values = states(spec), locale?: Locale, io: Record<string, unknown> = {}) {
  const path = `app/(dashboard)/tax/${spec.route}/page.tsx`;
  const require = createRequire(resolve(path));
  const compiled = { exports: {} as Record<string, ComponentType<{ orgId: string | null }>> };
  const events: [number, unknown][] = [], effects: (() => unknown)[] = [], titles: string[] = [];
  let index = 0;
  const code = ts.transpileModule(readFileSync(path, "utf8") + `\nexport { ${spec.component} };`, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
  const load = (id: string) => {
    if (id === "react") return { ...React, useState: () => { const i = index++; return [values[i], (v: unknown) => events.push([i, v])]; }, useEffect: (fn: () => unknown) => effects.push(fn) };
    if (id === "next-intl") return locale ? { useTranslations: () => translator(spec, locale) } : nextIntl;
    if (id.endsWith("/brand-loader")) return BrandLoader;
    if (id.endsWith("/export-button")) return ExportButton;
    if (id.endsWith("/date-range-filter")) return DateRangeFilter;
    if (id.endsWith("/use-document-title")) return { useDocumentTitle: (title: string) => titles.push(title) };
    return require(id.startsWith("@/") ? resolve(id.slice(2)) : id);
  };
  new Function("require", "module", "exports", ...Object.keys(io), code)(load, compiled, compiled.exports, ...Object.values(io));
  return { Page: compiled.exports[spec.component], events, effects, titles };
}
const flush = () => new Promise(resolve => setImmediate(resolve));
const invoke = (h: ReturnType<typeof loaded>, orgId: string | null = "org-a") => {
  let tree: ReactNode;
  function Capture() { tree = (h.Page as (props: {orgId: string | null}) => ReactNode)({orgId}); return null; }
  renderWithPresentation(createElement(Capture));
  return tree;
};

test("BAS renders bilingual summaries, statutory IDs, known labels and refund/zero/payable exact values", () => {
  const spec = specs[0];
  for (const locale of locales) for (const currency of ["USD", "JPY", "IRR", "KWD"]) for (const amount of [-1250n, 0n, 1250n]) {
    const t = translator(spec, locale);
    const h = loaded(spec, states(spec, { 2: basRows.map(row => row.field === "NET" ? { ...row, amount } : row), 4: currency }));
    const html = renderWithPresentation(createElement(h.Page, { orgId: "org-a" }), locale);
    for (const key of ["title", "description", "print", "taxPeriods", "comparison", "salesComparison", "purchasesComparison", "gstInformation", amount < 0n ? "netRefund" : "netPayable", amount < 0n ? "atoRefund" : "atoPayable"] as const) assert.ok(copyMarkup(html).includes(escape(t(key))), key);
    for (const id of basIds.filter(id => id !== "NET")) assert.ok(copyMarkup(html).includes(escape(t(basFieldLabelKey(id)!))) && html.includes(id));
    assert.ok(!html.includes("wire-") && html.includes("G1-G11, 1A-1B"));
    assert.ok(html.includes(escape(taxUiMoney(amount < 0n ? -amount : amount, currency, { locale, numerals: locale === "fa-IR" ? "arabext" : "latn" }))));
    assert.deepEqual(h.titles, [t("documentTitle")]);
  }
});

test("Schedule C renders all current subtype labels, sections, worksheet warning and profit/loss amounts", () => {
  const spec = specs[2];
  for (const locale of locales) for (const currency of ["USD", "JPY", "IRR", "KWD"]) for (const profit of [-1250n, 0n, 1250n]) {
    const t = translator(spec, locale);
    const lines = [...scheduleRows, { line: "31", label: caller, amount: profit }];
    const h = loaded(spec, states(spec, { 2: lines, 5: profit, 7: currency }));
    const html = renderWithPresentation(createElement(h.Page, { orgId: "org-a" }), locale);
    for (const key of ["title", "description", "print", "worksheetNoticeTitle", "worksheetNotice", "comparison", "grossIncome", "totalExpenses", "netProfitLoss", "incomePart", "incomeLines", "expensesPart", "expenseLines", "summary", profit < 0n ? "lineLoss" : "lineProfit"] as const) assert.ok(copyMarkup(html).includes(escape(t(key))), key);
    for (const id of scheduleIds) assert.ok(copyMarkup(html).includes(escape(t(scheduleCLineLabelKey(id)!))), id);
    assert.ok(html.includes(escape(caller)) && !html.includes("<script>") && !html.includes("wire-"));
    assert.ok(html.includes(escape(taxUiMoney(profit < 0n ? -profit : profit, currency, { locale, numerals: locale === "fa-IR" ? "arabext" : "latn" }))));
    assert.ok(html.includes("opacity-40"));
    assert.deepEqual(h.titles, [t("documentTitle")]);
  }
});

test("sales tax renders bilingual ICU plurals, missing rates, caller data and exact aggregate sums", () => {
  const spec = specs[1];
  for (const locale of locales) for (const count of [0, 1, 2, 12]) for (const currency of ["USD", "JPY", "IRR", "KWD"]) {
    const t = translator(spec, locale);
    const rows = [{ ...salesRows[0], taxableAmount: 9007199254740991n, taxCollected: 9007199254740991n, invoiceCount: count }, { ...salesRows[1], taxableAmount: 2n, taxCollected: 2n, invoiceCount: 0 }];
    const h = loaded(spec, states(spec, { 2: rows, 5: currency }));
    const html = renderWithPresentation(createElement(h.Page, { orgId: "org-a" }), locale);
    for (const key of ["title", "description", "print", "taxPeriods", "taxCollected", "taxableSales", "exemptSales", "breakdown", "noTaxRate", "totalTaxCollected"] as const) assert.ok(copyMarkup(html).includes(escape(t(key))), key);
    assert.ok(copyMarkup(html).includes(escape(t("invoiceCount", { count }))));
    assert.ok(copyMarkup(html).includes(escape(t("rateInvoices", { rate: "14.50%", count }))));
    assert.ok(copyMarkup(html).includes(escape(t("rateInvoices", { rate: t("notAvailable"), count: 0 }))));
    assert.ok(copyMarkup(html).includes(escape(t("onAmount", { amount: taxUiMoney(9007199254740991n, currency, { locale, numerals: locale === "fa-IR" ? "arabext" : "latn" }) }))));
    assert.ok(html.includes(escape(taxUiMoney(9007199254740993n, currency, { locale, numerals: locale === "fa-IR" ? "arabext" : "latn" }))));
    assert.ok(html.includes(escape(caller)) && !html.includes("<script>"));
    assert.deepEqual(h.titles, [t("documentTitle")]);
  }
});

test("unknown/prototype-like report IDs retain escaped labels and finite mappings reject them", () => {
  for (const locale of locales) for (const id of ["constructor", "__proto__", "unknown"]) {
    assert.equal(basFieldLabelKey(id), null); assert.equal(scheduleCLineLabelKey(id), null);
    for (const spec of [specs[0], specs[2]]) {
      const row = spec.route === "bas" ? { field: id, label: caller, amount: 1250n } : { line: id, label: caller, amount: 1250n };
      const html = renderWithPresentation(createElement(loaded(spec, states(spec, { 2: [row] })).Page, { orgId: "org-a" }), locale);
      assert.ok(html.includes(escape(caller)) && !html.includes("<script>"));
      if (spec.route === "bas") assert.ok(html.includes(escape(translator(spec, locale)("otherObligations"))));
    }
  }
});

test("all report loading, empty and error states render with real shared controls", () => {
  for (const spec of specs) for (const locale of locales) for (const mode of ["loading", "empty", "error"]) {
    const t = translator(spec, locale);
    const patch = mode === "loading" ? { [spec.loadingIndex]: true } : mode === "error" ? { [spec.errorIndex]: t("loadFailed") } : { 2: [] };
    const html = renderWithPresentation(createElement(loaded(spec, states(spec, patch)).Page, { orgId: "org-a" }), locale);
    if (mode === "loading") assert.ok(html.includes(escape((locale === "en-US" ? en : fa).SharedUI.loading2)));
    if (mode === "error") assert.ok(html.includes('role="alert"') && copyMarkup(html).includes(escape(t("loadFailed"))));
    if (spec.route !== "schedule-c") assert.ok(html.includes('href="/tax/periods"'));
  }
});

test("date controls, print and machine CSV retain canonical values, raw labels and failure gating", () => {
  for (const spec of specs) for (const locale of locales) {
    let printed = 0;
    const h = loaded(spec, states(spec), locale, { window: { print: () => printed++ } });
    const tree = nodes(invoke(h));
    const date = tree.find(el => el.props.startDate === "2026-01-01")!;
    (date.props.onDateChange as (s: string, e: string) => void)("2026-04-01", "2026-06-30");
    assert.deepEqual(h.events, [[0, "2026-04-01"], [1, "2026-06-30"]]);
    const print = tree.find(el => Array.isArray(el.props.children) && el.props.children.includes(translator(spec, locale)("print")))!;
    (print.props.onClick as () => void)(); assert.equal(printed, 1);
    const filename = spec.route === "schedule-c" ? "schedule-c-2026" : spec.route;
    const csv = tree.find(el => el.props.filename === filename)!;
    assert.deepEqual(csv.props.columns, [...spec.columns]);
    const expected = spec.route === "sales-tax" ? salesRows.map(row => ({ taxRate: row.taxRateName || "Exempt", ratePercent: row.taxRatePercent == null ? "" : "14.50", taxableAmount: String(row.taxableAmount), taxCollected: String(row.taxCollected), invoiceCount: row.invoiceCount, currencyCode: "USD" }))
      : spec.rows.map(row => ({ ...("field" in row ? { field: row.field } : { line: row.line }), description: "label" in row ? row.label : "", amount: "amount" in row ? String(row.amount) : "", currencyCode: "USD" }));
    assert.deepEqual(csv.props.data, expected);
    for (const patch of [{ [spec.loadingIndex]: true }, { [spec.errorIndex]: "error" }, { [spec.currencyIndex]: null }]) {
      const tree = nodes(invoke(loaded(spec, states(spec, patch), locale)));
      assert.deepEqual(tree.find(el => el.props.filename === filename)!.props.data, []);
    }
  }
});

test("report effects preserve org/date queries, validation, cancellation and localized failures", async () => {
  for (const spec of specs) for (const locale of locales) for (const mode of ["success", "status", "json", "shape", "alias", "summary-alias", "currency", "network", "cancelled", "no-org"]) {
    let calls = 0;
    const h = loaded(spec, states(spec), locale, { fetch: async (url: string, init: RequestInit) => {
      calls++; const parsed = new URL(url, "http://localhost");
      assert.equal(parsed.pathname, `/api/v1/reports/${spec.route}`);
      assert.deepEqual(Object.fromEntries(parsed.searchParams), { startDate: "2026-01-01", endDate: "2026-03-31" });
      assert.deepEqual(init.headers, { "x-organization-id": "org-a" });
      if (mode === "network") throw new Error(caller);
      if (mode === "json") return new Response(caller);
      const response: Record<string, unknown> = JSON.parse(JSON.stringify(spec.response));
      const rowsKey = spec.route === "bas" ? "fields" : spec.route === "sales-tax" ? "breakdown" : "lines";
      const rows = response[rowsKey] as Record<string, unknown>[];
      if (mode === "shape") response[rowsKey] = {};
      if (mode === "alias") rows[0][spec.route === "sales-tax" ? "taxCollectedMinor" : "amountMinor"] = "1251";
      if (mode === "summary-alias") {
        if (spec.route === "sales-tax") response.exemptAmountMinor = "251";
        else if (spec.route === "schedule-c") response.netProfitMinor = "1251";
        else rows[0].amountMinor = "1251";
      }
      return Response.json({ ...response, currencyCode: mode === "currency" ? "BAD" : "USD" }, { status: mode === "status" ? 403 : 200 });
    } });
    invoke(h, mode === "no-org" ? null : "org-a");
    const cleanup = h.effects[0](); if (mode === "cancelled") (cleanup as () => void)();
    await flush(); assert.equal(calls, mode === "no-org" ? 0 : 1);
    if (mode === "cancelled") assert.deepEqual(h.events, [[spec.loadingIndex, true]]);
    else if (mode === "no-org") assert.deepEqual(h.events, []);
    else if (mode === "success") {
      const expectedRows = JSON.parse(JSON.stringify(spec.response))[spec.route === "bas" ? "fields" : spec.route === "sales-tax" ? "breakdown" : "lines"] as Record<string, unknown>[];
      for (const row of expectedRows) for (const key of spec.route === "sales-tax" ? ["taxableAmount", "taxCollected"] : ["amount"]) row[key] = BigInt(row[key] as number);
      assert.deepEqual(h.events.slice(0, 4), [[spec.loadingIndex, true], [2, expectedRows], [spec.currencyIndex, "USD"], [spec.errorIndex, null]]);
      if (spec.route === "sales-tax") assert.deepEqual(h.events[4], [3, 250n]);
      if (spec.route === "schedule-c") assert.deepEqual(h.events.slice(4, 7), [[3, 2500n], [4, 1250n], [5, 1250n]]);
      assert.deepEqual(h.events.at(-1), [spec.loadingIndex, false]);
    } else assert.deepEqual(h.events, [[spec.loadingIndex, true], [spec.errorIndex, translator(spec, locale)("loadFailed")], [spec.currencyIndex, null], [spec.loadingIndex, false]]);
  }
});

test("all authored report copy is cataloged with paired keys and Persian script", () => {
  for (const spec of specs) {
    const path = `app/(dashboard)/tax/${spec.route}/page.tsx`, source = readFileSync(path, "utf8");
    const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    function visit(node: ts.Node) {
      if (ts.isJsxText(node)) assert.match(node.text.trim(), /^(G1-G11, 1A-1B|)$/, node.text.trim());
      if (ts.isJsxAttribute(node) && ["title", "description", "placeholder", "aria-label"].includes(node.name.getText(ast)) && node.initializer) assert.ok(!ts.isStringLiteral(node.initializer));
      if (ts.isCallExpression(node) && node.expression.getText(ast) === "useDocumentTitle") assert.ok(!node.arguments.some(ts.isStringLiteral));
      ts.forEachChild(node, visit);
    }
    visit(ast); assert.ok(!source.includes("err.message"));
    assert.deepEqual(Object.keys(en[spec.namespace]), Object.keys(fa[spec.namespace]));
    for (const value of Object.values(fa[spec.namespace])) assert.match(value, /[\u0600-\u06ff]/);
  }
  assert.equal(Object.keys(en.BasReport).length + Object.keys(en.SalesTaxReport).length + Object.keys(en.ScheduleCReport).length, 78);
});
