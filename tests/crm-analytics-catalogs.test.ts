import { resolvePresentation } from "../i18n/locale";
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { createElement, type ComponentType, type ReactNode } from "react";
import * as React from "react";
import * as jsx from "react/jsx-runtime";
import * as nextIntl from "next-intl";
import { createTranslator } from "next-intl";
import ts from "typescript";
import * as BrandLoader from "../components/dashboard/brand-loader";
import { crmAnalyticsJson, crmAnalyticsStageKeys } from "../i18n/crm-analytics-presentation";
import { payrollMoneyDisplay } from "../lib/money/payroll-display";
import { renderWithPresentation } from "./helpers/presentation";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";

const page = "app/(dashboard)/crm/analytics/page.tsx";
const locales = ["en-US", "fa-IR"] as const;
type Locale = typeof locales[number];
const caller = "<script>custom_stage & name</script>";
const max = Number.MAX_SAFE_INTEGER;
const stage = (count: number, value: number) => ({ count, value, valueMinor: String(value) });
const analytics = {
  currency: "KWD", totalDeals: 4, openDeals: 2, wonDeals: 1, lostDeals: 1,
  totalPipelineValue: max, totalPipelineValueMinor: String(max), wonValue: 1, wonValueMinor: "1",
  conversionRate: 50, avgDealValue: 1, avgDealValueMinor: "1",
  stageDistribution: { lead: stage(1, max), closed_won: stage(1, 1), closed_lost: stage(1, 2), [caller]: stage(1, 0) },
};
const empty = { ...analytics, totalDeals: 0, openDeals: 0, wonDeals: 0, lostDeals: 0,
  totalPipelineValue: 0, totalPipelineValueMinor: "0", wonValue: 0, wonValueMinor: "0",
  conversionRate: 0, avgDealValue: 0, avgDealValueMinor: "0", stageDistribution: {} };
const translator = (locale: Locale) => createTranslator({ locale, messages: locale === "en-US" ? en : fa, namespace: "CrmAnalytics" });
const escape = (v: string) => v.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#x27;");
type Capture = { kind: string; props: Record<string, unknown> };
type Harness = { html: string; captured: Capture[]; effects: (() => void | (() => void))[]; events: [string, unknown][] };

// Execute the production component and real UI/money/next-intl; control hooks, IO and portal controls.
function render(states: Record<string, unknown> = {}, locale: Locale = "en-US"): Harness {
  const ast = ts.createSourceFile(page, readFileSync(page, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
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
  const inline = (kind: string) => function Inline(props: Record<string, unknown>) {
    h.captured.push({ kind, props });
    return createElement("div", null, props.children as ReactNode,
      typeof props.message === "string" ? createElement("span", { role: "alert" }, props.message) : null);
  };
  let index = 0;
  const require = createRequire(resolve(page)), compiled = { exports: {} as { default: ComponentType } };
  const load = (id: string): unknown => {
    if (id === "react") return { ...React, useState: (initial: unknown) => {
      const key = names[index++]; return [Object.hasOwn(states, key) ? states[key] : initial, (v: unknown) => h.events.push([key, v])];
    }, useEffect: (fn: () => void | (() => void)) => h.effects.push(fn) };
    if (id === "react/jsx-runtime") return { ...jsx, jsx: capture(jsx.jsx), jsxs: capture(jsx.jsxs) };
    if (id === "next-intl") return nextIntl;
    if (id.endsWith("/brand-loader")) return BrandLoader;
    if (id.endsWith("/error-state")) return { ErrorState: inline("ErrorState") };
    if (id.endsWith("/currency-select")) return { CurrencySelect: inline("CurrencySelect") };
    if (id.endsWith("/content-reveal")) return { ContentReveal: inline("ContentReveal") };
    if (id.endsWith("/use-document-title")) return { useDocumentTitle: (v: string) => h.events.push(["title", v]) };
    return require(id.startsWith("@/") ? resolve(id.slice(2)) : id);
  };
  const code = ts.transpileModule(ast.text, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  new Function("require", "module", "exports", code)(load, compiled, compiled.exports);
  h.html = renderWithPresentation(createElement(compiled.exports.default), locale);
  return h;
}
const has = (h: Harness, key: string, value: unknown) => h.events.some(e => e[0] === key && e[1] === value);
const flush = async () => { for (let i = 0; i < 6; i++) await new Promise(resolve => setImmediate(resolve)); };
async function withIO(fetcher: typeof fetch, run: () => Promise<void>, org: string | null = "org-a", storageThrows = false) {
  const original = globalThis.fetch, storage = Object.getOwnPropertyDescriptor(globalThis, "localStorage"), window = Object.getOwnPropertyDescriptor(globalThis, "window");
  globalThis.fetch = fetcher;
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: (key: string) => { assert.equal(key, "activeOrgId"); if (storageThrows) throw new Error("private storage"); return org; } } });
  Object.defineProperty(globalThis, "window", { configurable: true, value: { location: { reload() { reloads++; } } } });
  try { await run(); } finally {
    globalThis.fetch = original;
    if (storage) Object.defineProperty(globalThis, "localStorage", storage); else Reflect.deleteProperty(globalThis, "localStorage");
    if (window) Object.defineProperty(globalThis, "window", window); else Reflect.deleteProperty(globalThis, "window");
  }
}
let reloads = 0;

test("IRR analytics renders literal Persian rial while retaining the ISO selector and query", async () => {
  const rial = { ...analytics, currency: "IRR" };
  for (const locale of locales) {
    const h = render({ loading: false, data: rial, currency: "IRR" }, locale);
    assert.ok(h.html.includes(locale === "fa-IR" ? "ریال" : "IRR"));
    assert.ok(h.html.includes(escape(payrollMoneyDisplay(max, "IRR", resolvePresentation({ user: { language: locale } })))));
    assert.equal(h.captured.find(c => c.kind === "CurrencySelect")!.props.value, "IRR");
    await withIO(async (url, init) => {
      assert.equal(url, "/api/v1/crm/analytics?currency=IRR");
      assert.equal((init?.headers as Record<string, string>)["x-organization-id"], "org-a");
      return Response.json(rial);
    }, async () => {
      const loading = render({ currency: "IRR" }, locale);
      loading.effects[0](); await flush();
      assert.deepEqual(loading.events.find(e => e[0] === "data" && e[1] !== null)?.[1], rial);
    });
  }
});

test("analytics production JSX renders bilingual statistics, exact fixed cents, stage labels and escaped custom IDs", () => {
  for (const locale of locales) {
    const t = translator(locale), h = render({ loading: false, data: analytics, currency: "KWD" }, locale);
    assert.ok(has(h, "title", t("documentTitle")));
    for (const key of ["title", "description", "currency", "allCurrencies", "pipelineValue", "wonRevenue", "conversionRate", "averageDealSize", "dealSummary", "totalDeals", "open", "won", "lost", "stageDistribution"] as const) assert.ok(h.html.includes(escape(t(key))), key);
    assert.ok(h.html.includes(escape(payrollMoneyDisplay(max, "KWD", resolvePresentation({ user: { language: locale } })))));
    assert.ok(h.html.includes(escape(t("percent", { value: 50 }))));
    assert.ok(h.html.includes(escape(t("dealCount", { count: 1 }))));
    assert.ok(h.html.includes(escape(caller)) && !h.html.includes("<script>"));
    const stageT = createTranslator({ locale, messages: locale === "en-US" ? en : fa, namespace: "CrmPipeline" });
    const allStages = { ...analytics, stageDistribution: Object.fromEntries(Object.keys(crmAnalyticsStageKeys).map(key => [key, stage(1, 1)])) };
    const stages = render({ loading: false, data: allStages }, locale);
    for (const key of Object.values(crmAnalyticsStageKeys)) assert.ok(stages.html.includes(escape(stageT(key))), key);
    for (const count of [0, 1, 2]) assert.ok(render({ loading: false, data: { ...analytics, stageDistribution: { lead: stage(count, 0) } } }, locale).html.includes(escape(t("dealCount", { count }))));
    assert.ok(render({ loading: false, data: empty }, locale).html.includes(escape(t("dealSummary"))));
    assert.ok(render({}, locale).captured.some(c => c.kind === "BrandLoader"));
  }
});

test("analytics reader validates complete counts, stage money, exact aliases, currency and consistent statistics", async () => {
  assert.deepEqual(await crmAnalyticsJson(Response.json(analytics), "KWD"), analytics);
  assert.deepEqual(await crmAnalyticsJson(Response.json(empty)), empty);
  for (const patch of [null, [], { currency: "private" }, { currency: "kwd" }, { currency: "USD" },
    { totalDeals: -1 }, { totalDeals: 3 }, { openDeals: 1.5 }, { wonDeals: "1" }, { lostDeals: null },
    { conversionRate: 101 }, { conversionRate: 33 }, { avgDealValue: 2, avgDealValueMinor: "2" },
    { totalPipelineValueMinor: "1" }, { wonValueMinor: "01" }, { avgDealValueMinor: undefined },
    { stageDistribution: null }, { stageDistribution: [] }, { stageDistribution: {} },
    { stageDistribution: { lead: { count: 4, value: 0 } } },
    { stageDistribution: { lead: stage(4, 0) } },
    { stageDistribution: { lead: stage(4, max + 1) } },
    { stageDistribution: { lead: stage(-1, 0) } },
    { stageDistribution: { "": stage(4, max) } },
    { stageDistribution: { lead: { ...stage(4, max), valueMinor: "0" } } },
  ]) {
    const body = patch === null || Array.isArray(patch) ? patch : { ...analytics, ...patch };
    await assert.rejects(crmAnalyticsJson(Response.json(body), "KWD"), JSON.stringify(patch));
  }
  for (const response of [Response.json({}), new Response("private"), Response.json(analytics, { status: 403 })]) await assert.rejects(crmAnalyticsJson(response));
  const won = { ...empty, totalDeals: 2, wonDeals: 2, wonValue: 5, wonValueMinor: "5", avgDealValue: 3, avgDealValueMinor: "3", conversionRate: 100, stageDistribution: { closed_won: stage(2, 5) } };
  assert.equal((await crmAnalyticsJson(Response.json(won))).avgDealValue, 3);
});

test("analytics read preserves query/org contracts, hides private failures and completes loading", async () => {
  for (const locale of locales) for (const currency of ["", "KWD"]) for (const mode of ["ok", "http", "json", "envelope", "currency", "network", "org", "storage"]) {
    let calls = 0;
    await withIO(async (url, init) => {
      calls++; assert.equal(url, `/api/v1/crm/analytics${currency ? "?currency=KWD" : ""}`);
      assert.equal((init?.headers as Record<string, string>)["x-organization-id"], "org-a");
      if (mode === "network") throw new Error("private network");
      if (mode === "json") return new Response("private JSON");
      return Response.json(mode === "envelope" ? {} : mode === "currency" ? { ...analytics, currency: "USD" } : mode === "http" ? { error: "private server" } : analytics, { status: mode === "http" ? 422 : 200 });
    }, async () => {
      const h = render({ currency }, locale); h.effects[0](); await flush();
      const ok = mode === "ok" || mode === "currency" && !currency;
      assert.equal(has(h, "data", null), !ok);
      assert.equal(h.events.filter(e => e[0] === "data" && e[1] !== null).length, ok ? 1 : 0);
      assert.ok(has(h, "loading", false));
      assert.ok(has(h, "error", ok ? null : translator(locale)("loadFailed")));
      assert.equal(JSON.stringify(h.events).includes("private"), false);
      assert.equal(calls, ["org", "storage"].includes(mode) ? 0 : 1);
    }, mode === "org" ? null : "org-a", mode === "storage");
  }
});

test("analytics cleanup ignores obsolete reads and currency/reset/retry callbacks retain their behavior", async () => {
  for (const fail of [false, true]) {
    let finish!: (r: Response) => void;
    await withIO(async () => new Promise<Response>(resolve => { finish = resolve; }), async () => {
      const old = render({ currency: "USD" }); const cleanup = old.effects[0]();
      (cleanup as () => void)(); finish(Response.json(fail ? {} : { ...analytics, currency: "USD" })); await flush();
      assert.deepEqual(old.events.filter(e => e[0] !== "title"), []);
    });
  }
  for (const locale of locales) await withIO(async () => Response.json(analytics), async () => {
    const t = translator(locale), h = render({ loading: false, data: analytics, currency: "KWD", error: t("loadFailed") }, locale);
    const select = h.captured.find(c => c.kind === "CurrencySelect")!;
    const change = select.props.onValueChange as (v: string) => void;
    change("KWD"); assert.equal(has(h, "loading", true), false);
    change("JPY"); assert.ok(has(h, "currency", "JPY") && has(h, "loading", true));
    const reset = h.captured.find(c => c.kind === "Button" && c.props.children === t("allCurrencies"))!;
    (reset.props.onClick as () => void)(); assert.ok(has(h, "currency", ""));
    const before = reloads;
    (h.captured.find(c => c.kind === "ErrorState")!.props.onRetry as () => void)(); assert.equal(reloads, before + 1);
    assert.ok(h.html.includes(escape(t("loadFailed"))));
  });
});

test("analytics catalogs are paired Persian text and JSX has no residual authored English", () => {
  assert.deepEqual(Object.keys(en.CrmAnalytics), Object.keys(fa.CrmAnalytics));
  for (const [key, value] of Object.entries(fa.CrmAnalytics)) assert.match(value, /[\u0600-\u06ff]/, key);
  const ast = ts.createSourceFile(page, readFileSync(page, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  function visit(n: ts.Node) {
    if (ts.isJsxText(n)) assert.doesNotMatch(n.getText(ast), /[A-Za-z]/);
    if (ts.isJsxAttribute(n) && ["title", "placeholder", "aria-label"].includes(n.name.getText(ast)) && n.initializer && ts.isStringLiteral(n.initializer)) assert.doesNotMatch(n.initializer.text, /[A-Za-z]/);
    ts.forEachChild(n, visit);
  }
  visit(ast);
});
