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
import * as detailPresentation from "../i18n/crm-detail-presentation";
import * as loader from "../components/dashboard/brand-loader";
import { crmDealDetailJson, crmDealMutationJson, crmDealDeletedJson, crmActivityCreatedJson } from "../i18n/crm-presentation";
import { payrollMoneyDisplay } from "../lib/money/payroll-display";
import { formatDateOnly, formatInstant } from "../i18n/dates";
import { resolvePresentation } from "../i18n/locale";
import { renderWithPresentation } from "./helpers/presentation";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";

const root = "app/(dashboard)/crm/deals/[id]/", layout = root + "layout.tsx", overview = root + "page.tsx", settings = root + "settings/page.tsx";
const caller = '<script>caller & "name"</script>';
const pipeline = { id: "pipeline-a", name: caller, isDefault: true, stages: [{ id: "lead", name: caller, color: "#10b981" }, { id: "qualified", name: "Custom stage", color: "#aabbcc" }] };
const activity = { id: "activity-a", type: "call", content: caller, createdAt: new Date(Date.now() - 120000).toISOString(), user: null };
const deal = { id: "deal-a", title: caller, stageId: "lead", valueCents: Number.MAX_SAFE_INTEGER, valueCentsMinor: String(Number.MAX_SAFE_INTEGER), currency: "KWD", probability: 33, expectedCloseDate: "2024-02-29", source: "cold_outreach", notes: caller, lostReason: caller, createdAt: "2026-10-21T00:00:00.000Z", wonAt: null, lostAt: null, contact: { id: "contact-a", name: caller, email: "caller@example.test" }, assignedUser: { id: "user-a", name: caller }, pipeline, activities: [activity] };
type Locale = "en-US" | "fa-IR";
const locales: Locale[] = ["en-US", "fa-IR"];
const translator = (locale: Locale) => createTranslator({ locale, messages: locale === "en-US" ? en : fa, namespace: "CrmDetail" });
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
  const context = { deal, saving: false, stageChanging: false, confirm, setSaving: (v: unknown) => h.events.push(["saving", v]), fetchDeal: async () => h.events.push(["refresh"]), changeStage: async (id: string) => h.events.push(["stage", id]), ...(states.context as object) };
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
    if (id.endsWith("/content-reveal")) return { ContentReveal: ({ children }: { children: ReactNode }) => createElement("div", null, children) };
    return require(id.startsWith("@/") ? resolve(id.slice(2)) : id);
  }
  h.html = renderWithPresentation(createElement(evaluate(file).default as ComponentType, {}), locale);
  return h;
}
const loaded = { loading: false, deal };
const has = (h: Harness, key: string, value: unknown) => h.events.some(v => JSON.stringify(v) === JSON.stringify([key, value]));
const flush = async () => { for (let i = 0; i < 8; i++) await new Promise(resolve => setImmediate(resolve)); };
const invoke = async (h: Harness, key: string, ...args: unknown[]) => { await (h.context[key] as (...args: unknown[]) => Promise<void>)(...args); };
function childText(value: unknown): string {
  if (Array.isArray(value)) return value.map(childText).join("");
  if (React.isValidElement<{ children?: unknown }>(value)) return childText(value.props.children);
  return typeof value === "string" ? value : "";
}
const button = (h: Harness, label: string) => h.captured.find(c => c.kind === "Button" && childText(c.props.children).includes(label))!;
const submit = (h: Harness) => (h.captured.find(c => c.kind === "form")!.props.onSubmit as (e: unknown) => Promise<void>)({ preventDefault() {}, currentTarget: {} });
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

test("CRM detail, overview and settings render bilingual copy with escaped caller data and exact weighted cents", () => {
  for (const locale of locales) {
    const t = translator(locale), shell = render(layout, loaded, locale), page = render(overview, {}, locale), form = render(settings, {}, locale);
    for (const [h, keys] of [[shell, ["overview", "activity", "settings", "markWon", "markLost", "backToPipeline"]], [page, ["dealInformation", "contact", "assignedTo", "expectedClose", "recentActivity", "keyMetrics", "weightedValue", "pipelineStage", "system", "call"]], [form, ["general", "generalDescription", "dealTitle", "expectedCloseDate", "notesDescription", "dangerZone", "deleteWarning", "saveChanges"]]] as const) {
      for (const key of keys) assert.ok(h.html.includes(escape(t(key))), key);
      assert.ok(h.html.includes(escape(caller)) && !h.html.includes("<script>"));
      assert.ok(h.html.includes(escape(payrollMoneyDisplay(deal.valueCents, "KWD"))));
    }
    const weighted = (BigInt(deal.valueCents) * 33n * 2n + 100n) / 200n;
    assert.ok(page.html.includes(escape(payrollMoneyDisplay(weighted, "KWD"))));
    assert.ok(page.html.includes(escape(t("viewAll", { count: 1 }))));
    assert.ok(page.html.includes(escape(t("minutesAgo", { count: 2 }))));
    assert.ok(form.html.includes("2024-02-29") && form.html.includes('name="probability"'));
    const presentation = resolvePresentation({ user: { language: locale } });
    assert.ok(page.html.includes(escape(formatDateOnly(deal.expectedCloseDate, presentation, { year: "numeric", month: "long", day: "numeric" }))));
    assert.ok(page.html.includes(escape(t("createdOn", { date: formatInstant(new Date(deal.createdAt), presentation, { year: "numeric", month: "long", day: "numeric" }) }))));
    for (const key of ["overview", "activity", "settings"] as const) {
      const nav = shell.captured.find(c => c.kind === "button" && childText(c.props.children) === t(key))!;
      (nav.props.onClick as () => void)();
      assert.ok(has(shell, "push", `/crm/deals/${deal.id}` + (key === "overview" ? "" : `/${key}`)));
    }
    const empty = render(overview, { context: { deal: { ...deal, activities: [], source: null, contact: null, assignedUser: null } } }, locale);
    assert.ok(empty.html.includes(escape(t("noActivity"))) && empty.html.includes(escape(t("logFirst"))));
    for (const [field, key] of [["wonAt", "won"], ["lostAt", "lost"]] as const) {
      const closed = render(layout, { ...loaded, deal: { ...deal, [field]: deal.createdAt } }, locale);
      assert.ok(closed.html.includes(escape(t(key)))); assert.equal(button(closed, t("markWon")), undefined);
      assert.ok(render(overview, { context: { deal: { ...deal, [field]: deal.createdAt } } }, locale).html.includes(escape(t(field === "wonAt" ? "wonOn" : "lostOn", { date: "" }).trim())));
    }
    assert.ok(render(layout, { loading: false }, locale).html.includes(escape(t("unavailable"))));
    assert.ok(render(settings, { context: { saving: true } }, locale).html.includes(escape(t("saving"))));
  }
});

test("CRM detail readers validate real envelopes, IDs, joins, activities and saved exact aliases before adoption", async () => {
  assert.deepEqual((await crmDealDetailJson(Response.json({ deal }), deal.id)).deal, deal);
  await crmDealMutationJson(Response.json({ deal }), deal.id);
  await crmDealDeletedJson(Response.json({ success: true }));
  await crmActivityCreatedJson(Response.json({ activity: { ...activity, user: undefined, dealId: deal.id, userId: "user-a" } }), deal.id);
  for (const reader of [crmDealDetailJson, crmDealMutationJson]) {
    for (const response of [new Response("private"), Response.json({ deal }, { status: 403 }), Response.json({}), Response.json({ deal: { ...deal, id: "foreign" } }), Response.json({ deal: { ...deal, valueCentsMinor: "1" } })]) await assert.rejects(reader(response, deal.id));
  }
  for (const patch of [{ contact: {} }, { assignedUser: { id: "", name: null } }, { notes: 1 }, { lostReason: {} }, { pipeline: { ...pipeline, stages: [{ ...pipeline.stages[0], color: "url(private)" }] } }, { activities: null }, { activities: [activity, activity] }, { activities: [{ ...activity, type: "private" }] }, { activities: [{ ...activity, createdAt: "bad" }] }, { activities: [{ ...activity, user: {} }] }]) await assert.rejects(crmDealDetailJson(Response.json({ deal: { ...deal, ...patch } }), deal.id));
  for (const body of [{}, { success: false }, { success: "true" }]) await assert.rejects(crmDealDeletedJson(Response.json(body)));
  await assert.rejects(crmActivityCreatedJson(Response.json({ activity: { ...activity, id: "" } }), deal.id));
});

test("CRM detail read failures never adopt data; cleanup ignores late responses and releases loading", async () => {
  for (const mode of ["ok", "http", "json", "envelope", "network", "org", "storage", "cancel"]) {
    await withIO(async (url, init) => {
      assert.equal(url, `/api/v1/crm/deals/${deal.id}`); assert.equal((init?.headers as Record<string, string>)["x-organization-id"], "org-a");
      if (mode === "network") throw new Error("private");
      return mode === "json" ? new Response("private") : Response.json(mode === "envelope" ? {} : { deal }, { status: mode === "http" ? 403 : 200 });
    }, async () => {
      const h = render(layout), cleanup = h.effects[0](); if (mode === "cancel") (cleanup as () => void)(); await flush();
      assert.equal(has(h, "deal", deal), mode === "ok");
      assert.equal(has(h, "loading", false), mode !== "cancel");
      assert.equal(h.events.some(e => e[0] === "error"), !["ok", "cancel"].includes(mode));
    }, mode === "org" ? null : "org-a", mode === "storage");
  }
});

test("CRM superseded reads cannot overwrite newer detail and old-route rows never render", async () => {
  const pending: ((r: Response) => void)[] = [];
  await withIO(async () => new Promise<Response>(resolve => pending.push(resolve)), async () => {
    const h = render(layout, loaded), first = invoke(h, "fetchDeal"), second = invoke(h, "fetchDeal");
    const updated = { ...deal, title: "Current title" };
    pending[1](Response.json({ deal: updated })); await second;
    pending[0](Response.json({ deal })); await first;
    assert.ok(has(h, "deal", updated)); assert.ok(!has(h, "deal", deal));
    const old = render(layout, { ...loaded, deal: { ...deal, id: "previous-route" } });
    assert.ok(!old.html.includes(escape(caller)));
  });
});

test("CRM shared activity callback validates its unjoined create reply and retains failed input", async () => {
  for (const locale of locales) for (const mode of ["ok", "http", "json", "envelope", "foreign", "network", "org", "storage"]) {
    await withIO(async (url, init) => {
      assert.equal(url, `/api/v1/crm/deals/${deal.id}/activities`); assert.equal(init?.method, "POST");
      assert.deepEqual(JSON.parse(init?.body as string), { type: "call", content: caller });
      if (mode === "network") throw new Error("private");
      return mode === "json" ? new Response("private") : Response.json(mode === "envelope" ? {} : { activity: { ...activity, user: undefined, userId: "user-a", dealId: mode === "foreign" ? "foreign" : deal.id } }, { status: mode === "http" ? 403 : 201 });
    }, async () => {
      const h = render(layout, { ...loaded, activityType: "call", activityContent: caller }, locale), t = translator(locale);
      assert.equal(await (h.context.addActivity as () => Promise<boolean>)(), mode === "ok");
      assert.equal(has(h, "success", t("activityAdded")), mode === "ok");
      assert.equal(has(h, "activityContent", ""), mode === "ok");
      assert.equal(has(h, "error", t("activityFailed")), mode !== "ok");
      assert.ok(has(h, "submitting", false));
    }, mode === "org" ? null : "org-a", mode === "storage");
  }
});

test("CRM stage/won/lost actions check replies, retain machine bodies and separate mutation success from refresh failure", async () => {
  for (const locale of locales) for (const [operation, suffix, method, body, success, failure] of [
    ["changeStage", "stage", "PATCH", { stageId: "qualified" }, "stageUpdated", "stageFailed"],
    ["markWon", "won", "POST", undefined, "markedWon", "wonFailed"],
    ["markLost", "lost", "POST", { reason: null }, "markedLost", "lostFailed"],
  ] as const) for (const mode of ["ok", "http", "json", "envelope", "network", "refresh"]) {
    let calls = 0;
    await withIO(async (url, init) => {
      calls++; assert.equal((init?.headers as Record<string, string>)["x-organization-id"], "org-a");
      if (calls > 1) { assert.equal(url, `/api/v1/crm/deals/${deal.id}`); return Response.json(mode === "refresh" ? {} : { deal }); }
      assert.equal(url, `/api/v1/crm/deals/${deal.id}/${suffix}`); assert.equal(init?.method, method); assert.equal(init?.body, body ? JSON.stringify(body) : undefined);
      if (mode === "network") throw new Error("private");
      return mode === "json" ? new Response("private") : Response.json(mode === "envelope" ? {} : { deal }, { status: mode === "http" ? 403 : 200 });
    }, async () => {
      const h = render(layout, loaded, locale), t = translator(locale); await invoke(h, operation, "qualified");
      assert.equal(has(h, "success", t(success)), ["ok", "refresh"].includes(mode));
      assert.equal(has(h, "error", t(failure)), !["ok", "refresh"].includes(mode));
      assert.equal(has(h, "error", t("loadFailed")), mode === "refresh");
      assert.ok(has(h, "stageChanging", false)); assert.equal(calls, ["ok", "refresh"].includes(mode) ? 2 : 1);
      if (operation === "markLost") { const opts = h.events.find(e => e[0] === "confirm")![1] as Record<string, unknown>; assert.equal(opts.cancelLabel, t("cancel")); }
    });
  }
  await withIO(async () => { throw new Error("must not fetch"); }, async () => { const h = render(layout, { ...loaded, confirmed: false }); await invoke(h, "markLost"); assert.ok(!h.events.some(e => e[0] === "success" || e[0] === "error")); });
});

test("CRM settings preserve form/request fields, release saving and prevent false update/delete success", async () => {
  for (const locale of locales) for (const operation of ["save", "delete"]) for (const mode of ["ok", "http", "json", "envelope", "network", "org", "storage", "cancel"]) {
    let calls = 0;
    await withIO(async (url, init) => {
      calls++; assert.equal(url, `/api/v1/crm/deals/${deal.id}`); assert.equal(init?.method, operation === "save" ? "PATCH" : "DELETE");
      assert.equal((init?.headers as Record<string, string>)["x-organization-id"], "org-a");
      if (operation === "save") assert.deepEqual(JSON.parse(init!.body as string), { title: caller, notes: caller, probability: 33, expectedCloseDate: "2024-02-29" });
      if (mode === "network") throw new Error("private");
      return mode === "json" ? new Response("private") : Response.json(mode === "envelope" ? {} : operation === "save" ? { deal } : { success: true }, { status: mode === "http" ? 403 : 200 });
    }, async () => {
      const h = render(settings, { confirmed: mode !== "cancel" }, locale), t = translator(locale);
      if (operation === "save") await submit(h); else await (button(h, t("deleteDeal")).props.onClick as () => Promise<void>)();
      const ok = mode === "ok" || (mode === "cancel" && operation === "save");
      assert.equal(has(h, "success", t(operation === "save" ? "updated" : "deleted")), ok);
      assert.equal(has(h, "push", "/crm"), ok && operation === "delete");
      assert.equal(h.events.some(e => e[0] === "refresh"), ok && operation === "save");
      if (operation === "save") assert.ok(has(h, "saving", false));
      assert.equal(calls, ["org", "storage"].includes(mode) || (mode === "cancel" && operation === "delete") ? 0 : 1);
      assert.ok(!h.events.some(e => String(e[1]).includes("private")));
      if (operation === "delete") { const opts = h.events.find(e => e[0] === "confirm")![1] as Record<string, unknown>; assert.equal(opts.title, t("deleteTitle", { title: caller })); }
    }, mode === "org" ? null : "org-a", mode === "storage");
  }
});

test("CRM detail catalog pairs contain Persian text; owned JSX has no residual authored copy", () => {
  assert.deepEqual(Object.keys(en.CrmDetail), Object.keys(fa.CrmDetail));
  for (const [key, value] of Object.entries(fa.CrmDetail)) assert.match(value, /[\u0600-\u06ff]/, key);
  for (const file of [layout, overview, settings]) {
    const ast = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    function visit(n: ts.Node) {
      if (ts.isJsxText(n)) assert.doesNotMatch(n.getText(ast), /[A-Za-z]/, n.getText(ast));
      if (ts.isJsxAttribute(n) && ["title", "placeholder", "description", "aria-label"].includes(n.name.getText(ast)) && n.initializer && ts.isStringLiteral(n.initializer)) assert.doesNotMatch(n.initializer.text, /[A-Za-z]/);
      ts.forEachChild(n, visit);
    }
    visit(ast);
  }
});
