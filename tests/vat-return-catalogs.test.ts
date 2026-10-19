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
import { vatBoxLabelKey } from "../lib/i18n/vat-return-presentation";
import { renderWithPresentation } from "./helpers/presentation";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";

const path = "app/(dashboard)/tax/vat-return/page.tsx";
const source = readFileSync(path, "utf8");
const locales = ["en-US", "fa-IR"] as const;
const caller = '<script>شرح & reference</script>';
const noop = () => {};
const escape = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#x27;");
const translator = (locale: typeof locales[number]) => createTranslator({ locale, messages: locale === "en-US" ? en : fa, namespace: "VatReturn" });
const boxes = Array.from({ length: 9 }, (_, i) => ({ box: String(i + 1), label: `wire-label-${i + 1}`, amount: i === 4 ? -1250n : 1250n }));
const row = { journalLineId: "line-a", journalEntryId: "entry-a", entryNumber: 42, date: "2026-01-02", description: caller, reference: caller, sourceType: "manual", accountCode: "2200", accountName: caller, amount: 1250n, debit: 0n, credit: 1250n };
const states = (patch: Record<number, unknown> = {}) => Object.assign(["2026-01-01", "2026-03-31", "accrual", "14.5", true, boxes, false, "USD", null, null, {}, null], patch);
type Tree = ReactElement<Record<string, unknown>>;
function nodes(node: ReactNode): Tree[] {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(nodes);
  const el = node as Tree;
  return el.props ? [el, ...nodes(el.props.children as ReactNode)] : [];
}

// Production templates and callbacks; own state/effects are controlled. Shared
// widgets and next-intl remain real during SSR, with direct translation only
// when inspecting unrendered callbacks/props outside React.
function loaded(values = states(), locale?: typeof locales[number], io: Record<string, unknown> = {}) {
  const require = createRequire(resolve(path));
  const compiled = { exports: {} as Record<string, ComponentType<{ orgId: string | null }>> };
  const events: [number, unknown][] = [], effects: (() => unknown)[] = [];
  const ref = { current: 0 }; let index = 0;
  const code = ts.transpileModule(source + "\nexport { VatReturnPageWorkspace };", { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
  const load = (id: string) => {
    if (id === "react") return { ...React, useState: () => { const i = index++; return [values[i], (v: unknown) => events.push([i, v])]; }, useEffect: (fn: () => unknown) => effects.push(fn), useRef: () => ref, useCallback: (fn: unknown) => fn };
    if (id === "next-intl") return locale ? { useTranslations: () => translator(locale) } : nextIntl;
    if (id.endsWith("/brand-loader")) return BrandLoader;
    if (id.endsWith("/export-button")) return ExportButton;
    if (id.endsWith("/date-range-filter")) return DateRangeFilter;
    if (id.endsWith("/use-document-title")) return { useDocumentTitle: noop };
    return require(id.startsWith("@/") ? resolve(id.slice(2)) : id);
  };
  new Function("require", "module", "exports", ...Object.keys(io), code)(load, compiled, compiled.exports, ...Object.values(io));
  return { Page: compiled.exports.VatReturnPageWorkspace, events, effects, ref };
}
const flush = () => new Promise(resolve => setImmediate(resolve));

test("VAT report renders all bilingual labels, nine statutory boxes and exact due/refund totals", () => {
  for (const locale of locales) for (const net of [-1250n, 0n, 1250n]) for (const currency of ["USD", "JPY", "IRR", "KWD"]) {
    const t = translator(locale);
    const h = loaded(states({ 5: boxes.map(b => b.box === "5" ? { ...b, amount: net } : b), 7: currency }));
    const html = renderWithPresentation(createElement(h.Page, { orgId: "org-a" }), locale);
    for (const key of ["title", "description", "print", "taxPeriods", "countVat", "accrual", "cash", "accrualHelp", "flatRate", "flatRatePlaceholder", "flatRatePercent", "flatRateHelp", "comparison", "outputVat", "inputVat", "allBoxes", "drillHelp", "calculated", net < 0n ? "netRefund" : "netDue", net < 0n ? "boxFiveRefund" : "boxFiveDue"] as const) assert.ok(html.includes(escape(t(key))), key);
    for (const box of boxes) assert.ok(html.includes(escape(t(vatBoxLabelKey(box.box)!))));
    assert.ok(!html.includes("wire-label-") && html.includes('href="/tax/periods"'));
    assert.ok(html.includes(escape(taxUiMoney(net < 0n ? -net : net, currency))));
    assert.equal((html.match(/aria-expanded="false"/g) ?? []).length, 2);
  }
});

test("loading, errors, cash basis, disabled flat rate and unknown box data render safely", () => {
  for (const locale of locales) {
    const t = translator(locale);
    for (const [patch, text] of [[{ 6: true }, (locale === "en-US" ? en : fa).SharedUI.loading2], [{ 8: t("loadFailed") }, t("loadFailed")], [{ 2: "cash", 4: false }, t("cashHelp")]] as const) {
      const html = renderWithPresentation(createElement(loaded(states(patch)).Page, { orgId: "org-a" }), locale);
      assert.ok(html.includes(escape(text)));
      if (patch[8 as keyof typeof patch]) assert.ok(html.includes('role="alert"'));
      if (patch[4 as keyof typeof patch] === false) assert.ok(html.includes('disabled=""'));
    }
    for (const box of ["constructor", "__proto__", "10"]) {
      assert.equal(vatBoxLabelKey(box), null);
      const html = renderWithPresentation(createElement(loaded(states({ 5: [{ box, label: caller, amount: 1250n }] })).Page, { orgId: "org-a" }), locale);
      assert.ok(html.includes(escape(caller)) && !html.includes("<script>"));
    }
  }
});

test("drilldown loading/empty/table states, ICU plurals and sums beyond safe Number render exactly", () => {
  for (const locale of locales) for (const count of [-1, 0, 1, 2]) {
    const t = translator(locale);
    const rows = count === 2 ? [{ ...row, amount: BigInt(Number.MAX_SAFE_INTEGER) }, { ...row, journalLineId: "line-b", amount: 2n, description: null, reference: null }] : [row];
    const h = loaded(states({ 9: "1", 10: { "1": count <= 0 ? [] : rows }, 11: count < 0 ? "1" : null }));
    const html = renderWithPresentation(createElement(h.Page, { orgId: "org-a" }), locale);
    assert.ok(html.includes('aria-expanded="true"'));
    if (count <= 0) assert.ok(html.includes(escape(t(count < 0 ? "loadingTransactions" : "noTransactions"))));
    else {
      for (const key of ["date", "entry", "transactionDescription", "reference", "amount"] as const) assert.ok(html.includes(escape(t(key))), key);
      assert.ok(html.includes(escape(t("totalLines", { count }))) && html.includes(escape(caller)) && !html.includes("<script>"));
      assert.ok(html.includes("2026-01-02") && html.includes("#42"));
      assert.ok(html.includes(escape(taxUiMoney(count === 2 ? 9007199254740993n : 1250n, "USD"))));
    }
    for (const n of [0, 1, 2, 12]) assert.ok(t("totalLines", { count: n }).length);
  }
});

test("real controls preserve basis codes, rate text, canonical dates, print and CSV wire data", () => {
  for (const locale of locales) {
    let printed = 0;
    const h = loaded(states(), locale, { window: { print: () => printed++ } });
    const tree = nodes((h.Page as (props: { orgId: string }) => ReactNode)({ orgId: "org-a" }));
    for (const [key, value] of [["accrual", "accrual"], ["cash", "cash"]] as const) {
      const el = tree.find(el => el.props.children === translator(locale)(key))!;
      (el.props.onClick as () => void)(); assert.deepEqual(h.events.at(-1), [2, value]);
    }
    const input = tree.find(el => el.props["aria-label"] === translator(locale)("flatRatePercent"))!;
    (input.props.onChange as (e: unknown) => void)({ target: { value: "17.5" } }); assert.deepEqual(h.events.at(-1), [3, "17.5"]);
    const date = tree.find(el => el.props.startDate === "2026-01-01")!;
    (date.props.onDateChange as (s: string, e: string) => void)("2026-04-01", "2026-06-30"); assert.deepEqual(h.events.slice(-2), [[0, "2026-04-01"], [1, "2026-06-30"]]);
    const print = tree.find(el => Array.isArray(el.props.children) && el.props.children.includes(translator(locale)("print")))!;
    (print.props.onClick as () => void)(); assert.equal(printed, 1);
    const csv = tree.find(el => el.props.filename === "vat-return")!;
    assert.deepEqual(csv.props.columns, ["box", "description", "amount", "currencyCode"]);
    assert.deepEqual(csv.props.data, boxes.map(b => ({ box: b.box, description: b.label, amount: String(b.amount), currencyCode: "USD" })));
    for (const patch of [{ 6: true }, { 8: "error" }, { 7: null }]) {
      const broken = loaded(states(patch), locale);
      const tree = nodes((broken.Page as (props: { orgId: string }) => ReactNode)({ orgId: "org-a" }));
      assert.deepEqual(tree.find(el => el.props.filename === "vat-return")!.props.data, []);
    }
  }
});

test("report effect preserves org/date/basis/basis-point queries and validates reads without raw prose", async () => {
  for (const locale of locales) for (const mode of ["success", "status", "json", "shape", "alias", "currency", "network", "cancelled", "no-org"]) {
    let calls = 0;
    const h = loaded(states(), locale, { fetch: async (url: string, init: RequestInit) => {
      calls++; const parsed = new URL(url, "http://localhost");
      assert.equal(parsed.pathname, "/api/v1/reports/vat-return");
      assert.deepEqual(Object.fromEntries(parsed.searchParams), { startDate: "2026-01-01", endDate: "2026-03-31", basis: "accrual", flatRatePercent: "1450" });
      assert.deepEqual(init.headers, { "x-organization-id": "org-a" });
      if (mode === "network") throw new Error(caller);
      if (mode === "json") return new Response(caller);
      return Response.json({ currencyCode: mode === "currency" ? "BAD" : "USD", boxes: mode === "shape" ? {} : [{ box: "1", label: caller, amount: 1250, amountMinor: mode === "alias" ? "1251" : "1250" }] }, { status: mode === "status" ? 403 : 200 });
    } });
    (h.Page as (props: { orgId: string | null }) => ReactNode)({ orgId: mode === "no-org" ? null : "org-a" });
    const cleanup = h.effects[0](); if (mode === "cancelled") (cleanup as () => void)();
    await flush(); assert.equal(calls, mode === "no-org" ? 0 : 1);
    if (mode === "success") assert.deepEqual(h.events, [[6, true], [5, [{ box: "1", label: caller, amount: 1250n, amountMinor: "1250" }]], [7, "USD"], [8, null], [6, false]]);
    else if (mode === "cancelled") assert.deepEqual(h.events, [[6, true]]);
    else if (mode === "no-org") assert.deepEqual(h.events, []);
    else assert.deepEqual(h.events, [[6, true], [8, translator(locale)("loadFailed")], [7, null], [6, false]]);
  }
});

test("flat-rate omission and cash request semantics remain unchanged", async () => {
  for (const [percent, on, expected] of [["", true, null], ["0", true, null], ["-1", true, null], ["oops", true, null], ["14.5", false, null], ["17.555", true, "1756"]] as const) {
    const h = loaded(states({ 2: "cash", 3: percent, 4: on }), "en-US", { fetch: async (url: string) => {
      const params = new URL(url, "http://localhost").searchParams;
      assert.equal(params.get("basis"), "cash"); assert.equal(params.get("flatRatePercent"), expected);
      return Response.json({ currencyCode: "USD", boxes: [] });
    } });
    (h.Page as (p: { orgId: string }) => ReactNode)({ orgId: "org-a" }); h.effects[0](); await flush();
    assert.ok(h.events.some(([i, value]) => i === 7 && value === "USD"));
  }
});

test("drill callback keeps org/box query, money validation, cancellation, cache and closing behavior", async () => {
  for (const locale of locales) for (const mode of ["success", "status", "json", "shape", "alias", "currency", "network", "stale", "cached", "close", "no-org"]) {
    let calls = 0;
    const h = loaded(states({ 9: mode === "close" ? "1" : null, 10: mode === "cached" ? { "1": [] } : {} }), locale, { fetch: async (url: string, init: RequestInit) => {
      calls++; const parsed = new URL(url, "http://localhost");
      assert.equal(parsed.pathname, "/api/v1/reports/vat-return/transactions");
      assert.deepEqual(Object.fromEntries(parsed.searchParams), { box: "1", startDate: "2026-01-01", endDate: "2026-03-31", basis: "accrual" });
      assert.deepEqual(init.headers, { "x-organization-id": "org-a" });
      if (mode === "network") throw new Error(caller);
      if (mode === "json") return new Response(caller);
      return Response.json({ currencyCode: mode === "currency" ? "JPY" : "USD", transactions: mode === "shape" ? {} : [{ ...row, amount: 1250, debit: 0, credit: 1250, amountMinor: mode === "alias" ? "1251" : "1250" }] }, { status: mode === "status" ? 400 : 200 });
    } });
    const tree = nodes((h.Page as (props: { orgId: string | null }) => ReactNode)({ orgId: mode === "no-org" ? null : "org-a" }));
    const button = tree.find(el => el.type === "button" && "aria-expanded" in el.props)!;
    (button.props.onClick as () => void)(); if (mode === "stale") h.ref.current++;
    await flush();
    assert.equal(calls, ["cached", "close", "no-org"].includes(mode) ? 0 : 1);
    if (mode === "close") assert.deepEqual(h.events, [[9, null]]);
    else if (["cached", "no-org"].includes(mode)) assert.deepEqual(h.events, [[9, "1"]]);
    else if (mode === "stale") assert.deepEqual(h.events, [[9, "1"], [11, "1"]]);
    else {
      assert.deepEqual(h.events.slice(0, 2), [[9, "1"], [11, "1"]]);
      if (mode === "success") {
        assert.equal(h.events[2][0], 10);
        assert.deepEqual((h.events[2][1] as (v: object) => object)({}), { "1": [{ ...row, amountMinor: "1250" }] });
      } else assert.deepEqual(h.events[2], [8, translator(locale)("drillFailed")]);
      assert.equal((h.events.at(-1)![1] as (v: string) => unknown)("1"), null);
    }
  }
});

test("period/basis invalidation clears drill cache and invalidates late results", () => {
  const h = loaded(states(), "en-US");
  (h.Page as (p: { orgId: string }) => ReactNode)({ orgId: "org-a" });
  const cleanup = h.effects[1]();
  assert.deepEqual(h.events, [[9, null], [10, {}]]); assert.equal(h.ref.current, 1);
  (cleanup as () => void)(); assert.equal(h.ref.current, 2);
});

test("authored UI copy is extracted, keys are paired and Persian strings retain script", () => {
  const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  function visit(node: ts.Node) {
    if (ts.isJsxText(node)) assert.match(node.text.trim(), /^(%|#|)$/, node.text.trim());
    if (ts.isJsxAttribute(node) && ["title", "description", "placeholder", "aria-label"].includes(node.name.getText(ast)) && node.initializer) assert.ok(!ts.isStringLiteral(node.initializer));
    if (ts.isCallExpression(node) && node.expression.getText(ast) === "useDocumentTitle") assert.ok(!node.arguments.some(ts.isStringLiteral));
    ts.forEachChild(node, visit);
  }
  visit(ast); assert.ok(!source.includes("err.message"));
  assert.equal(Object.keys(en.VatReturn).length, 43); assert.deepEqual(Object.keys(en.VatReturn), Object.keys(fa.VatReturn));
  for (const value of Object.values(fa.VatReturn)) assert.match(value, /[\u0600-\u06ff]/);
});
