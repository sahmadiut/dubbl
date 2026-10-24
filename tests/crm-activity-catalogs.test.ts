import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { createElement, type ComponentType, type ReactNode } from "react";
import * as React from "react";
import * as jsx from "react/jsx-runtime";
import ts from "typescript";
import { createTranslator } from "next-intl";
import * as nextIntl from "next-intl";
import * as activityPresentation from "../i18n/crm-activity-presentation";
import { crmActivitiesJson } from "../i18n/crm-presentation";
import * as detailPresentation from "../i18n/crm-detail-presentation";
import * as loader from "../components/dashboard/brand-loader";
import { payrollMoneyDisplay } from "../lib/money/payroll-display";
import { formatInstant } from "../i18n/dates";
import { resolvePresentation } from "../i18n/locale";
import { renderWithPresentation } from "./helpers/presentation";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";

const root = "app/(dashboard)/crm/deals/[id]/", layout = root + "layout.tsx", activityPage = root + "activity/page.tsx";
const caller = '<script>caller & "name"</script>';
const pipeline = { id: "pipeline-a", name: caller, isDefault: true, stages: [{ id: "lead", name: caller, color: "#10b981" }, { id: "qualified", name: "Custom stage", color: "#aabbcc" }] };
const activity = { id: "activity-a", type: "call", content: caller, createdAt: new Date(Date.now() - 120000).toISOString(), user: null };
const deal = { id: "deal-a", title: caller, stageId: "lead", valueCents: Number.MAX_SAFE_INTEGER, valueCentsMinor: String(Number.MAX_SAFE_INTEGER), currency: "KWD", probability: 33, expectedCloseDate: "2024-02-29", source: "cold_outreach", notes: caller, lostReason: caller, createdAt: "2026-10-21T00:00:00.000Z", wonAt: null, lostAt: null, contact: { id: "contact-a", name: caller, email: "caller@example.test" }, assignedUser: { id: "user-a", name: caller }, pipeline, activities: [activity] };
type Locale = "en-US" | "fa-IR";
const locales: Locale[] = ["en-US", "fa-IR"];
const translator = (locale: Locale) => createTranslator({ locale, messages: locale === "en-US" ? en : fa, namespace: "CrmActivity" });
const escape = (v: string) => v.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#x27;");
type Capture = { kind: string; props: Record<string, unknown> };
type Context = { [key: string]: unknown; deal: typeof deal };
type Harness = { captured: Capture[]; events: unknown[][]; effects: (() => unknown)[]; callbacks: (() => Promise<void>)[]; context: Context; html: string };

// Evaluate production JSX with actual next-intl, presentation, UI and money code.
// Control hooks/IO and the neighboring context to exercise the real callbacks.
function render(file: string, states: Record<string, unknown> = {}, locale: Locale = "en-US"): Harness {
  const ast = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const names: string[] = [];
  function hooks(n: ts.Node) {
    if (ts.isVariableDeclaration(n) && ts.isArrayBindingPattern(n.name) && n.initializer && ts.isCallExpression(n.initializer) && n.initializer.expression.getText(ast) === "useState") names.push(n.name.elements[0].getText(ast));
    ts.forEachChild(n, hooks);
  }
  hooks(ast);
  const h: Harness = { captured: [], events: [], effects: [], callbacks: [], context: { deal }, html: "" };
  const confirm = async (opts: unknown) => { h.events.push(["confirm", opts]); return states.confirmed !== false; };
  const context = { deal, activityType: "note", activityContent: caller, submitting: false, setActivityType: (v: string) => h.events.push(["activityType", v]), setActivityContent: (v: string) => h.events.push(["activityContent", v]), addActivity: async () => { h.events.push(["add"]); return states.addResult !== false; }, saving: false, stageChanging: false, confirm, setSaving: (v: unknown) => h.events.push(["saving", v]), fetchDeal: async () => h.events.push(["refresh"]), changeStage: async (id: string) => h.events.push(["stage", id]), ...(states.context as object) };
  let index = 0;
  const capture = (factory: typeof jsx.jsx) => (kind: unknown, props: Record<string, unknown>, key: string) => {
    h.captured.push({ kind: typeof kind === "string" ? kind : (kind as { name?: string })?.name ?? "", props });
    if (props.value && typeof props.value === "object" && "fetchDeal" in props.value) h.context = props.value as unknown as Context;
    return factory(kind as Parameters<typeof jsx.jsx>[0], props, key);
  };
  const require = createRequire(resolve(file));
  function evaluate(path: string): Record<string, unknown> {
    const compiled = { exports: {} };
    const source = ts.transpileModule(readFileSync(path, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
    new Function("require", "module", "exports", source)(load, compiled, compiled.exports);
    return compiled.exports;
  }
  function load(id: string): unknown {
    if (id === "next-intl") return nextIntl;
    if (id.endsWith("/crm-activity-presentation")) return activityPresentation;
    if (id.endsWith("/use-debounce")) return { useDebounce: (v: string) => states.debouncedSearch ?? v };
    if (id.endsWith("/crm-detail-presentation")) return detailPresentation;
    if (id.endsWith("/brand-loader")) return loader;
    if (id === "react") return { ...React,
      useState: (initial: unknown) => { const key = names[index++]; return [Object.hasOwn(states, key) ? states[key] : initial, (v: unknown) => h.events.push([key, v])]; },
      useEffect: (fn: () => unknown) => h.effects.push(fn), useCallback: (fn: () => Promise<void>) => { h.callbacks.push(fn); return fn; }, useRef: (initial: unknown) => ({ current: initial }),
    };
    if (id === "react/jsx-runtime") return { ...jsx, jsx: capture(jsx.jsx), jsxs: capture(jsx.jsxs) };
    if (id === "next/navigation") return { useParams: () => ({ id: deal.id }), usePathname: () => `/crm/deals/${deal.id}/settings`, useRouter: () => ({ push: (url: string) => h.events.push(["push", url]) }) };
    if (id === "sonner") return { toast: { success: (v: unknown) => h.events.push(["success", v]), error: (v: unknown) => h.events.push(["error", v]) } };
    if (id.endsWith("/use-entity-title")) return { useEntityTitle: (v: string) => h.events.push(["title", v]) };
    if (id.endsWith("/use-confirm")) return { useConfirm: () => ({ dialog: null, confirm }) };
    if (id === "../layout" || id === "./layout") return { ...evaluate(layout), useDealContext: () => context };
    if (id.endsWith("/search-input")) return evaluate("components/ui/search-input.tsx");
    if (id.endsWith("/content-reveal")) return { ContentReveal: ({ children }: { children: ReactNode }) => createElement("div", null, children) };
    return require(id.startsWith("@/") ? resolve(id.slice(2)) : id);
  }
  h.html = renderWithPresentation(createElement(evaluate(file).default as ComponentType, {}), locale);
  return h;
}
const loaded = { loading: false, activities: [activity], total: 1, totalAll: 1, typeCounts: { note: 0, email: 0, call: 1, meeting: 0, task: 0 } };
const has = (h: Harness, key: string, value: unknown) => h.events.some(v => JSON.stringify(v) === JSON.stringify([key, value]));
const flush = async () => { for (let i = 0; i < 8; i++) await new Promise(resolve => setImmediate(resolve)); };
function childText(value: unknown): string {
  if (Array.isArray(value)) return value.map(childText).join("");
  if (React.isValidElement<{ children?: unknown }>(value)) return childText(value.props.children);
  return typeof value === "string" ? value : "";
}
const button = (h: Harness, label: string) => h.captured.find(c => c.kind === "Button" && childText(c.props.children).includes(label))!;
async function withIO(fetcher: typeof fetch, run: () => Promise<void>, org: string | null = "org-a", storageThrows = false) {
  const original = { fetch: globalThis.fetch, FormData: globalThis.FormData, storage: Object.getOwnPropertyDescriptor(globalThis, "localStorage") };
  globalThis.fetch = fetcher;
  globalThis.FormData = class { get(key: string) { return ({ title: caller, notes: caller, probability: "33", expectedCloseDate: "2024-02-29" } as Record<string, string>)[key] ?? null; } } as unknown as typeof FormData;
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: (key: string) => { assert.equal(key, "activeOrgId"); if (storageThrows) throw new Error("private storage"); return org; } } });
  try { await run(); } finally {
    globalThis.fetch = original.fetch; globalThis.FormData = original.FormData;
    if (original.storage) Object.defineProperty(globalThis, "localStorage", original.storage); else Reflect.deleteProperty(globalThis, "localStorage");
  }
}

const feed = (page = 1, total = 1, rows = [activity]) => ({ activities: rows, pagination: { page, limit: 30, total, totalPages: Math.ceil(total / 30) }, totalAll: total, typeCounts: { note: 0, email: 0, call: total, meeting: 0, task: 0 } });
const changedRows = (h: Harness, previous: unknown[] = []) => h.events.filter(e => e[0] === "activities").map(e => typeof e[1] === "function" ? e[1](previous) : e[1]);

test("activity feed renders real bilingual copy, escaped caller data, type choices and exact cents", () => {
  for (const locale of locales) {
    const t = translator(locale), h = render(activityPage, loaded, locale);
    for (const key of ["logActivity", "addActivity", "filterByType", "totalActivities", "quickStats", "firstLogged", "mostRecent", "mostCommon", "calls"] as const) assert.ok(h.html.includes(escape(t(key))), key);
    assert.ok(h.html.includes(escape(caller)) && !h.html.includes("<script>"));
    for (const type of ["note", "email", "call", "meeting", "task"]) {
      const option = h.captured.find(c => c.kind === "SelectItem" && c.props.value === type); assert.ok(option, type);
    }
    assert.ok(h.captured.some(c => c.kind === "SelectValue" && c.props.placeholder === t("allTypes")));
    assert.ok(h.html.includes(escape(formatInstant(new Date(activity.createdAt), resolvePresentation({ user: { language: locale } }), { hour: "2-digit", minute: "2-digit" }))));
    const textarea = h.captured.find(c => c.kind === "Textarea")!;
    assert.equal(textarea.props.placeholder, t("placeholder_note"));
    (textarea.props.onChange as (e: unknown) => void)({ target: { value: caller } }); assert.ok(has(h, "activityContent", caller));
    for (const [value, next, state] of [["all", "call", "typeFilter"], ["date", "type", "sortBy"]]) {
      const select = h.captured.find(c => c.kind === "Select" && c.props.value === value)!;
      (select.props.onValueChange as (v: string) => void)(next); assert.ok(has(h, state, next));
    }
    const sort = h.captured.find(c => c.kind === "Button" && c.props["aria-label"] === t("sortAscending"))!;
    (sort.props.onClick as () => void)();
    const toggle = h.events.find(e => e[0] === "sortOrder")![1] as (v: string) => string;
    assert.equal(toggle("desc"), "asc"); assert.equal(toggle("asc"), "desc");
    for (const field of ["wonAt", "lostAt"]) {
      const closed = render(activityPage, { ...loaded, context: { deal: { ...deal, lostReason: null, [field]: deal.createdAt } } }, locale);
      assert.ok(closed.html.includes(escape(t(field === "wonAt" ? "dealWon" : "dealLost"))));
      if (field === "wonAt") assert.ok(closed.html.includes(escape(payrollMoneyDisplay(deal.valueCents, "KWD", resolvePresentation({ user: { language: locale } })))));
    }
    const empty = render(activityPage, { loading: false, hasMore: false }, locale);
    assert.ok(empty.html.includes(escape(t("noActivity"))));
    const filtered = render(activityPage, { loading: false, search: "needle", typeFilter: "call" }, locale);
    assert.ok(filtered.html.includes(escape(t("noMatching"))));
    (button(filtered, t("clearFilters")).props.onClick as () => void)(); assert.ok(has(filtered, "search", "") && has(filtered, "typeFilter", "all"));
    assert.ok(render(activityPage, {}, locale).html.includes(escape(t("loading"))));
    assert.ok(render(activityPage, { ...loaded, context: { submitting: true } }, locale).html.includes(escape(t("adding"))));
  }
});

test("activity reader rejects malformed pages, totals, joined fields and HTTP/JSON failures atomically", async () => {
  assert.deepEqual((await crmActivitiesJson(Response.json(feed()), 1)).activities, [activity]);
  for (const response of [new Response("private"), Response.json(feed(), { status: 403 }), Response.json({}),
    ...[{ activities: [activity, activity] }, { activities: [{ ...activity, type: "private" }] }, { activities: [{ ...activity, user: {} }] }, { activities: [{ ...activity, content: 42 }] }, { activities: [{ ...activity, createdAt: "bad" }] }, { pagination: { ...feed().pagination, page: 2 } }, { pagination: { ...feed().pagination, totalPages: 9 } }, { typeCounts: {} }, { totalAll: 9 }].map(patch => Response.json({ ...feed(), ...patch }))]) await assert.rejects(crmActivitiesJson(response, 1));
});

test("initial activity reads preserve query/org contracts, reject failures and ignore cleanup", async () => {
  for (const locale of locales) for (const mode of ["ok", "http", "json", "envelope", "network", "org", "storage", "cancel"]) {
    await withIO(async (url, init) => {
      assert.equal(url, `/api/v1/crm/deals/${deal.id}/activities?search=needle&type=call&sortBy=type&sortOrder=asc&page=1&limit=30`);
      assert.equal((init?.headers as Record<string, string>)["x-organization-id"], "org-a");
      if (mode === "network") throw new Error("private");
      return mode === "json" ? new Response("private") : Response.json(mode === "envelope" ? {} : feed(), { status: mode === "http" ? 403 : 200 });
    }, async () => {
      const h = render(activityPage, { search: "needle", typeFilter: "call", sortBy: "type", sortOrder: "asc" }, locale);
      const cleanup = h.effects[0](); if (mode === "cancel") (cleanup as () => void)(); await flush();
      assert.equal(changedRows(h).length, mode === "ok" ? 1 : 0);
      assert.equal(has(h, "error", translator(locale)("loadFailed")), !["ok", "cancel"].includes(mode));
      assert.equal(has(h, "loading", false), mode !== "cancel");
    }, mode === "org" ? null : "org-a", mode === "storage");
  }
});

test("load more rejects failures, guards duplicate requests and cannot overwrite a newer refresh", async () => {
  const pending: ((r: Response) => void)[] = [];
  await withIO(async () => new Promise<Response>(resolve => pending.push(resolve)), async () => {
    const h = render(activityPage, loaded), more = h.callbacks[1];
    const first = more(); await more(); assert.equal(pending.length, 1);
    const refresh = h.callbacks[0](); assert.equal(pending.length, 2);
    pending[1](Response.json(feed())); await refresh;
    pending[0](Response.json(feed(2, 31))); await first;
    assert.deepEqual(changedRows(h), [[activity]]);
    assert.ok(has(h, "loadingMore", false));
  });
  for (const mode of ["ok", "bad"]) await withIO(async () => Response.json(mode === "bad" ? {} : feed(2, 31, [{ ...activity, id: "second" }])), async () => {
    const h = render(activityPage, loaded); await h.callbacks[1]();
    assert.equal(changedRows(h, [activity]).length, mode === "ok" ? 1 : 0);
    assert.equal(has(h, "page", 2), mode === "ok"); assert.ok(has(h, "loadingMore", false));
    if (mode === "ok") assert.equal((changedRows(h, [activity])[0] as unknown[]).length, 2);
  });
});

test("activity submission refreshes only after a verified creation and reports refresh failure separately", async () => {
  for (const locale of locales) for (const mode of ["ok", "createFailed", "refreshFailed"]) {
    let calls = 0;
    await withIO(async () => { calls++; return Response.json(mode === "refreshFailed" ? {} : feed()); }, async () => {
      const h = render(activityPage, { ...loaded, addResult: mode !== "createFailed" }, locale);
      await (button(h, translator(locale)("addActivity")).props.onClick as () => Promise<void>)();
      assert.ok(has(h, "add", undefined) || h.events.some(e => e[0] === "add"));
      assert.equal(calls, mode === "createFailed" ? 0 : 1);
      assert.equal(has(h, "error", translator(locale)("loadFailed")), mode === "refreshFailed");
    });
  }
});

test("activity catalog is paired Persian text and production JSX has no residual authored English", () => {
  assert.deepEqual(Object.keys(en.CrmActivity), Object.keys(fa.CrmActivity));
  for (const [key, value] of Object.entries(fa.CrmActivity)) assert.match(value, /[\u0600-\u06ff]/, key);
  const ast = ts.createSourceFile(activityPage, readFileSync(activityPage, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  function visit(n: ts.Node) {
    if (ts.isJsxText(n)) assert.doesNotMatch(n.getText(ast), /[A-Za-z]/);
    if (ts.isJsxAttribute(n) && ["title", "placeholder", "aria-label"].includes(n.name.getText(ast)) && n.initializer && ts.isStringLiteral(n.initializer)) assert.doesNotMatch(n.initializer.text, /[A-Za-z]/);
    ts.forEachChild(n, visit);
  }
  visit(ast);
});
