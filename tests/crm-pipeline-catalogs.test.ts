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
import { crmPipelinesJson, crmPipelineCreatedJson, crmDealCreatedJson, crmDealsJson } from "../i18n/crm-presentation";
import { payrollMoneyDisplay } from "../lib/money/payroll-display";
import { renderWithPresentation } from "./helpers/presentation";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";

const page = "app/(dashboard)/crm/page.tsx", drawer = "components/dashboard/create-drawer.tsx";
const locales = ["en-US", "fa-IR"] as const;
type Locale = typeof locales[number];
const caller = "<script>caller & name</script>";
const pipeline = { id: "pipe-a", name: caller, stages: [{ id: "lead", name: caller, color: "#10b981" }, { id: "closed_won", name: "Custom closing", color: "#10b981" }], isDefault: true };
const deal = { id: "deal-a", title: caller, stageId: "lead", currency: "KWD", valueCents: Number.MAX_SAFE_INTEGER, valueCentsMinor: String(Number.MAX_SAFE_INTEGER), probability: 33, source: "cold_outreach", expectedCloseDate: "2024-02-29", createdAt: "2026-10-21T00:00:00.000Z", wonAt: null, lostAt: null, contact: { name: caller }, assignedUser: { name: caller } };
const summary = { currency: "KWD", activeCount: 1, activeValue: deal.valueCents, activeValueMinor: deal.valueCentsMinor, wonCount: 0, wonValue: 0, wonValueMinor: "0", totalDeals: 10, stageDistribution: { lead: { count: 1, value: deal.valueCents, valueMinor: deal.valueCentsMinor } } };
const list = { data: [deal], summary, pagination: { total: 1 } };
const translator = (locale: Locale) => createTranslator({ locale, messages: locale === "en-US" ? en : fa, namespace: "CrmPipeline" });
const escape = (v: string) => v.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#x27;");
type Capture = { kind: string; props: Record<string, unknown> };
type Harness = { callbacks: unknown[]; captured: Capture[]; events: unknown[]; effects: (() => void | (() => void))[] };

// Production JSX, next-intl, footer and money inputs; control hook/IO state and portals.
function render(file: string, states: Record<string, unknown> = {}, locale: Locale = "en-US") {
  const ast = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const name = file === page ? "CRMPage" : "DealDrawer";
  const owner = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === name)!;
  const names: string[] = [];
  function hooks(n: ts.Node) {
    if (ts.isVariableDeclaration(n) && ts.isArrayBindingPattern(n.name) && n.initializer && ts.isCallExpression(n.initializer) && n.initializer.expression.getText(ast) === "useState") names.push(n.name.elements[0].getText(ast));
    ts.forEachChild(n, hooks);
  }
  hooks(owner);
  let source = ast.text;
  if (file === drawer) {
    const functions = ast.statements.filter(n => ts.isFunctionDeclaration(n) && n.name && [name, "DrawerFooter", "DrawerIcon", "SectionLabel"].includes(n.name.text));
    const used = new Set<string>();
    function identifiers(n: ts.Node) { if (ts.isIdentifier(n)) used.add(n.text); ts.forEachChild(n, identifiers); }
    functions.forEach(identifiers);
    source = ast.statements.flatMap(n => {
      if (functions.includes(n)) return [n.getText(ast)];
      if (ts.isImportDeclaration(n) && n.importClause?.namedBindings && ts.isNamedImports(n.importClause.namedBindings)) {
        const bindings = n.importClause.namedBindings.elements.filter(b => used.has(b.name.text));
        if (bindings.length) return [`import { ${bindings.map(b => b.getText(ast)).join(", ")} } from ${n.moduleSpecifier.getText(ast)};`];
      }
      return [];
    }).join("\n");
  }
  source += `\nexport { ${name} };`;
  const h: Harness = { callbacks: [], captured: [], events: [], effects: [] };
  const capture = (factory: typeof jsx.jsx) => (kind: unknown, props: Record<string, unknown>, key: string) => {
    h.captured.push({ kind: typeof kind === "string" ? kind : (kind as { name?: string })?.name ?? "", props });
    return factory(kind as Parameters<typeof jsx.jsx>[0], props, key);
  };
  const inline = (kind: string) => function Inline(props: Record<string, unknown>) {
    h.captured.push({ kind, props });
    return createElement("div", { "data-control": kind }, props.children as ReactNode,
      typeof props.placeholder === "string" ? createElement("span", null, props.placeholder) : null,
      typeof props.message === "string" ? createElement("span", { role: "alert" }, props.message) : null);
  };
  let index = 0;
  const require = createRequire(resolve(file)), compiled = { exports: {} as Record<string, ComponentType<Record<string, unknown>>> };
  const load = (id: string): unknown => {
    if (id === "react") return { ...React, useState: (initial: unknown) => {
      const key = names[index++]; return [Object.hasOwn(states, key) ? states[key] : initial, (v: unknown) => h.events.push([key, v])];
    }, useEffect: (fn: () => void | (() => void)) => h.effects.push(fn), useCallback: (fn: unknown) => { h.callbacks.push(fn); return fn; }, useMemo: (fn: () => unknown) => fn(), useRef: (initial: unknown) => ({ current: initial }) };
    if (id === "react/jsx-runtime") return { ...jsx, jsx: capture(jsx.jsx), jsxs: capture(jsx.jsxs) };
    if (id === "next-intl") return nextIntl;
    if (id === "motion/react") return { motion: { div: inline("MotionDiv") } };
    if (id.endsWith("/use-debounce")) return { useDebounce: (v: unknown) => v };
    if (id.endsWith("/error-state")) return { ErrorState: inline("ErrorState") };
    if (id.endsWith("/search-input")) return { SearchInput: inline("SearchInput") };
    if (id.endsWith("/currency-select")) return { CurrencySelect: inline("CurrencySelect") };
    if (id.endsWith("/brand-loader")) return BrandLoader;
    if (id === "sonner") return { toast: { error: (v: unknown) => h.events.push(["error", v]), success: (v: unknown) => h.events.push(["success", v]) } };
    if (id === "next/navigation") return { useRouter: () => ({ push: (v: string) => h.events.push(["push", v]) }) };
    if (id.endsWith("/create-drawer")) return { useCreateDrawer: () => ({ open: (v: string) => h.events.push(["drawer", v]) }) };
    if (id.endsWith("/dev-delay")) return { devDelay: async () => {} };
    if (id.endsWith("/use-document-title")) return { useDocumentTitle: (v: string) => h.events.push(["title", v]) };
    if (id.endsWith("/use-confirm")) return { useConfirm: () => ({ dialog: null, confirm: async (v: unknown) => { h.events.push(["confirm", v]); return states.confirmed !== false; } }) };
    if (id.endsWith("/content-reveal")) return { ContentReveal: inline("ContentReveal") };
    for (const [suffix, names] of Object.entries({ "/ui/select": ["Select", "SelectContent", "SelectItem", "SelectTrigger", "SelectValue"], "/ui/tabs": ["Tabs", "TabsList", "TabsTrigger"], "/ui/sheet": ["Sheet", "SheetContent", "SheetHeader", "SheetTitle", "SheetDescription"], "/ui/date-picker": ["DatePicker"], "/contact-picker": ["ContactPicker"] }))
      if (id.endsWith(suffix)) return Object.fromEntries(names.map(key => [key, inline(key)]));
    return require(id.startsWith("@/") ? resolve(id.slice(2)) : id);
  };
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  new Function("require", "module", "exports", code)(load, compiled, compiled.exports);
  const html = renderWithPresentation(createElement(compiled.exports[name], { open: true, onClose: () => h.events.push(["close"]) }), locale);
  return { ...h, html };
}
const has = (h: Harness, key: string, value?: unknown) => h.events.some(v => JSON.stringify(v) === JSON.stringify(value === undefined ? [key] : [key, value]));
const flush = async () => { for (let i = 0; i < 6; i++) await new Promise(resolve => setImmediate(resolve)); };
function submit(h: Harness) { return (h.captured.find(c => c.kind === "form")!.props.onSubmit as (event: unknown) => Promise<void>)({ preventDefault() {}, currentTarget: {} }); }
async function withIO(fetcher: typeof fetch, run: (events: string[]) => Promise<void>, org: string | null = "org-a", fields: Record<string, string> = {}, storageThrows = false) {
  const fetchValue = globalThis.fetch, formValue = globalThis.FormData;
  const descriptors = ["localStorage", "window"].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const), events: string[] = [];
  globalThis.fetch = fetcher;
  globalThis.FormData = class { get(key: string) { return fields[key] ?? null; } } as unknown as typeof FormData;
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: (key: string) => { assert.equal(key, "activeOrgId"); if (storageThrows) throw new Error("Private storage"); return org; } } });
  Object.defineProperty(globalThis, "window", { configurable: true, value: { dispatchEvent: (e: Event) => events.push(e.type), location: { reload: () => events.push("reload") }, confirm: (v: string) => { events.push(v); return false; }, addEventListener() {}, removeEventListener() {} } });
  try { await run(events); } finally {
    globalThis.fetch = fetchValue; globalThis.FormData = formValue;
    for (const [key, d] of descriptors) if (d) Object.defineProperty(globalThis, key, d); else Reflect.deleteProperty(globalThis, key);
  }
}

const loaded = { initialLoading: false, pipelinesReady: true, pipelines: [pipeline], activePipeline: pipeline, deals: [deal], summary, total: 1 };
const drawerState = { pipelines: [pipeline], pipelineId: pipeline.id, stageId: "lead", value: "90071992547409.91", probability: "33", source: "cold_outreach", expectedClose: "2024-02-29", contactId: "contact-a" };

test("CRM pipeline renders bilingual list, counts, exact cents, caller data and machine filter values", () => {
  for (const locale of locales) {
    const t = translator(locale), h = render(page, loaded, locale);
    assert.ok(has(h, "title", t("documentTitle")));
    for (const key of ["salesPipeline", "newDeal", "currency", "stageDistribution", "search", "coldOutreach"] as const) assert.ok(h.html.includes(escape(t(key))), key);
    assert.ok(h.html.includes(escape(caller)) && !h.html.includes("<script>"));
    assert.ok(h.html.includes(escape(payrollMoneyDisplay(deal.valueCents, "KWD"))));
    assert.ok(h.html.includes(escape(t("dealCount", { count: 1 }))));
    for (const value of ["cold_outreach", "won", "probability"]) assert.ok(h.captured.some(c => c.kind === "SelectItem" && c.props.value === value));
    const card = h.captured.find(c => c.kind === "button" && c.props.className?.toString().includes("w-full rounded-xl"))!;
    (card.props.onClick as () => void)(); assert.ok(has(h, "push", `/crm/deals/${deal.id}`));
    (h.captured.find(c => c.kind === "Button" && c.props.size === "sm")!.props.onClick as () => void)(); assert.ok(has(h, "drawer", "deal"));
    for (const count of [0, 1, 2]) assert.ok(render(page, { ...loaded, total: count }, locale).html.includes(escape(t("dealCount", { count }))));
    assert.ok(render(page, { ...loaded, sourceFilter: "referral" }, locale).html.includes(escape(t("filteredCount", { count: 1 }))));
    assert.ok(render(page, { ...loaded, deals: [] }, locale).html.includes(escape(t("noDeals"))));
    const failedMore = render(page, { ...loaded, error: "moreFailed", hasMore: false }, locale).html;
    assert.ok(failedMore.includes(escape(t("moreFailed"))) && !failedMore.includes(escape(t("noMore"))));
    for (const [field, key] of [["wonAt", "won"], ["lostAt", "lost"]] as const) assert.ok(render(page, { ...loaded, deals: [{ ...deal, [field]: deal.createdAt }] }, locale).html.includes(escape(t(key))));
  }
});

test("CRM onboarding and drawer extract examples, finite options, dirty confirmation and busy feedback", async () => {
  for (const locale of locales) {
    const t = translator(locale), intro = render(page, { initialLoading: false }, locale);
    for (const key of ["intro", "examplePipeline", "sampleTitle1", "sampleContact1", "sampleSummary", "sampleProbability", "trackTitle", "forecastDescription", "logDescription", "analyzeDescription", "lead", "won"] as const) assert.ok(intro.html.includes(escape(t(key))), key);
    const h = render(drawer, { ...drawerState, dirty: true, pipelineError: true }, locale);
    for (const key of ["newDeal", "drawerDescription", "titleRequired", "stage", "associatedContact", "valueProbability", "winProbability", "details", "selectSource", "notesPlaceholder", "createDeal", "pipelinesFailed"] as const) assert.ok(h.html.includes(escape(t(key))), key);
    assert.ok(h.captured.some(c => c.kind === "SelectItem" && c.props.value === "cold_outreach" && c.props.children === t("coldOutreach")));
    assert.equal(h.captured.filter(c => c.kind === "SelectItem" && c.props.value === "closed_won").length, 0);
    assert.ok(h.html.includes(escape(caller)) && !h.html.includes("<script>"));
    assert.ok(render(drawer, { ...drawerState, saving: true }, locale).html.includes(escape((locale === "en-US" ? en : fa).DocumentForms.creating)));
    await withIO(async () => { throw new Error("No fetch"); }, async events => {
      (h.captured.find(c => c.kind === "Sheet")!.props.onOpenChange as (v: boolean) => void)(false);
      assert.deepEqual(events, [t("discard")]); assert.equal(has(h, "close"), false);
    });
  }
});

test("CRM readers reject HTTP/JSON/envelopes, malformed cents, stages, dates, counts and identities", async () => {
  assert.deepEqual(await crmPipelinesJson(Response.json({ pipelines: [pipeline] })), { pipelines: [pipeline] });
  assert.deepEqual(await crmPipelineCreatedJson(Response.json({ pipeline })), { pipeline });
  assert.deepEqual(await crmDealCreatedJson(Response.json({ deal })), { deal });
  assert.deepEqual(await crmDealsJson(Response.json(list)), list); // Summary intentionally spans the full unfiltered dataset.
  for (const read of [crmPipelinesJson, crmPipelineCreatedJson, crmDealCreatedJson, crmDealsJson]) {
    for (const body of [null, [], {}, { error: "private diagnostic" }]) await assert.rejects(read(Response.json(body)));
    await assert.rejects(read(Response.json(list, { status: 403 })));
    await assert.rejects(read(new Response("private invalid JSON")));
  }
  for (const patch of [{ stages: [] }, { stages: [{ ...pipeline.stages[0], color: "url(private)" }] }, { stages: [pipeline.stages[0], pipeline.stages[0]] }, { id: "" }, { isDefault: "true" }]) await assert.rejects(crmPipelinesJson(Response.json({ pipelines: [{ ...pipeline, ...patch }] })));
  for (const patch of [{ id: "" }, { valueCentsMinor: "1" }, { valueCentsMinor: undefined }, { currency: "usd" }, { probability: 101 }, { probability: 0.1 }, { source: "secret" }, { expectedCloseDate: "2024-02-30" }, { contact: {} }, { createdAt: "bad" }, { wonAt: deal.createdAt, lostAt: deal.createdAt }]) await assert.rejects(crmDealsJson(Response.json({ ...list, data: [{ ...deal, ...patch }] })));
  for (const patch of [{ data: [deal, deal] }, { pagination: { total: -1 } }, { summary: { ...summary, activeCount: 0.5 } }, { summary: { ...summary, activeValueMinor: "1" } }]) await assert.rejects(crmDealsJson(Response.json({ ...list, ...patch })));
});

test("CRM pipeline reads adopt checked data, reject failures and ignore cleanup", async () => {
  for (const file of [page, drawer]) {
    for (const mode of ["ok", "http", "json", "envelope", "network", "org", "storage", "cancel"]) await withIO(async (url, init) => {
      assert.equal(String(url), "/api/v1/crm/pipelines"); assert.equal((init?.headers as Record<string, string>)["x-organization-id"], "org-a");
      if (mode === "network") throw new Error("private");
      if (mode === "json") return new Response("private");
      return Response.json(mode === "envelope" ? {} : { pipelines: [pipeline] }, { status: mode === "http" ? 403 : 200 });
    }, async () => {
      const h = render(file), effect = h.effects[file === drawer ? 1 : 0];
      const cleanup = effect(); if (mode === "cancel") (cleanup as () => void)(); await flush();
      assert.equal(has(h, "pipelines", [pipeline]), mode === "ok");
      if (!["ok", "cancel"].includes(mode)) assert.ok(file === page ? has(h, "error", "pipelinesFailed") && has(h, "initialLoading", false) : has(h, "pipelineError", true));
    }, mode === "org" ? null : "org-a", {}, mode === "storage");
  }
});

test("CRM deal list preserves filter/header contracts and suppresses cleaned-up/stale reads", async () => {
  await withIO(async (url, init) => {
    const q = new URL(String(url), "http://fixture").searchParams;
    for (const [key, value] of Object.entries({ page: "1", limit: "24", sortBy: "created", sortOrder: "asc", pipelineId: pipeline.id, source: "cold_outreach", status: "won", stageId: "lead", search: "caller", currency: "KWD" })) assert.equal(q.get(key), value);
    assert.equal((init?.headers as Record<string, string>)["x-organization-id"], "org-a"); return Response.json(list);
  }, async () => {
    const states = { ...loaded, sortBy: "date", sortOrder: "asc", sourceFilter: "cold_outreach", statusFilter: "won", stageFilter: "lead", search: "caller", currency: "KWD" };
    const h = render(page, states); h.effects[1](); await flush();
    assert.ok(has(h, "deals", [deal]) && has(h, "summary", summary) && has(h, "error", null));
    const cancelled = render(page, states), cleanup = cancelled.effects[0](); cancelled.effects[1](); (cleanup as () => void)(); await flush();
    assert.equal(has(cancelled, "deals", [deal]), false);
  });
  for (const mode of ["http", "json", "money", "network"]) await withIO(async () => {
    if (mode === "network") throw new Error("private");
    return mode === "json" ? new Response("private") : Response.json(mode === "money" ? { ...list, data: [{ ...deal, valueCentsMinor: "1" }] } : { error: "private" }, { status: mode === "http" ? 403 : 200 });
  }, async () => {
    const h = render(page, loaded); h.effects[1](); await flush(); assert.ok(has(h, "error", "dealsFailed") && has(h, "initialLoading", false));
    assert.equal(has(h, "deals", [deal]), false);
  });
});

test("CRM creation submits exact cents and canonical dates and only confirmed success dispatches/navigates", async () => {
  for (const locale of locales) for (const mode of ["ok", "http", "json", "envelope", "money", "network", "org", "storage", "input"]) await withIO(async (url, init) => {
    assert.equal(String(url), "/api/v1/crm/deals"); assert.equal(init?.method, "POST");
    assert.deepEqual(init?.headers, { "Content-Type": "application/json", "x-organization-id": "org-a" });
    assert.deepEqual(JSON.parse(String(init?.body)), { pipelineId: pipeline.id, stageId: "lead", contactId: "contact-a", title: "Caller title", valueCentsMinor: "9007199254740991", currency: "USD", probability: 33, expectedCloseDate: "2024-02-29", source: "cold_outreach", notes: caller });
    if (mode === "network") throw new Error("private");
    if (mode === "json") return new Response("private");
    return Response.json(mode === "envelope" ? {} : { deal: mode === "money" ? { ...deal, valueCentsMinor: "1" } : deal }, { status: mode === "http" ? 403 : 201 });
  }, async events => {
    const h = render(drawer, { ...drawerState, ...(mode === "input" ? { value: "1e3" } : {}) }, locale); await submit(h);
    assert.ok(has(h, "saving", false));
    assert.equal(has(h, "success", translator(locale)("dealCreated")), mode === "ok");
    assert.equal(has(h, "push", `/crm/deals/${deal.id}`), mode === "ok");
    assert.equal(events.includes("deals-changed"), mode === "ok");
    if (mode !== "ok") assert.ok(has(h, "error", translator(locale)(mode === "org" ? "organizationRequired" : "createFailed")));
  }, mode === "org" ? null : "org-a", { title: " Caller title ", notes: caller }, mode === "storage");
});

test("CRM pagination failures preserve existing rows and late prior requests cannot overwrite replacements", async () => {
  await withIO(async () => Response.json({ error: "private" }, { status: 403 }), async () => {
    const h = render(page, loaded), fetchDeals = h.callbacks[1] as (page: number, replace: boolean) => Promise<void>;
    await fetchDeals(2, false);
    assert.ok(has(h, "error", "moreFailed") && has(h, "page", 1) && has(h, "hasMore", false) && has(h, "loadingMore", false));
    assert.equal(h.events.some(v => (v as unknown[])[0] === "deals"), false);
  });
  let finishOld!: (r: Response) => void, calls = 0;
  await withIO(async () => ++calls === 1 ? new Promise<Response>(resolve => { finishOld = resolve; }) : Response.json(list), async () => {
    const h = render(page, loaded), fetchDeals = h.callbacks[1] as (page: number, replace: boolean) => Promise<void>;
    const old = fetchDeals(1, true); await fetchDeals(1, true);
    finishOld(Response.json({ ...list, data: [{ ...deal, id: "old-deal" }] })); await old;
    assert.deepEqual(h.events.filter(v => (v as unknown[])[0] === "deals"), [["deals", [deal]]]);
    // Append retains the existing records through the production functional updater.
    await fetchDeals(2, false);
    const updater = (h.events.filter(v => (v as unknown[])[0] === "deals").at(-1) as unknown[])[1] as (rows: unknown[]) => unknown[];
    assert.deepEqual(updater([{ ...deal, id: "prior" }]), [{ ...deal, id: "prior" }, deal]);
  });
});

test("CRM setup translates feedback while preserving saved pipeline and stage names", async () => {
  for (const locale of locales) for (const ok of [true, false]) await withIO(async (url, init) => {
    assert.equal(String(url), "/api/v1/crm/pipelines");
    const body = JSON.parse(String(init?.body)); assert.equal(body.name, "Sales Pipeline"); assert.equal(body.stages[0].id, "lead"); assert.equal(body.stages[0].name, "Lead");
    return Response.json(ok ? { pipeline } : { error: "private" }, { status: ok ? 201 : 403 });
  }, async events => {
    const h = render(page, { initialLoading: false }, locale);
    await (h.captured.find(c => c.kind === "Button")!.props.onClick as () => Promise<void>)();
    assert.ok(has(h, "setupLoading", false)); assert.equal(events.includes("reload"), ok);
    assert.ok(has(h, ok ? "success" : "error", translator(locale)(ok ? "pipelineCreated" : "setupFailed")));
  });
});

test("CRM authored JSX text is catalogued and every Persian message contains Persian script", () => {
  assert.deepEqual(Object.keys(en.CrmPipeline).sort(), Object.keys(fa.CrmPipeline).sort());
  for (const [key, value] of Object.entries(fa.CrmPipeline)) assert.match(value, /[\u0600-\u06ff]/, key);
  for (const file of [page, drawer]) {
    const full = readFileSync(file, "utf8"), source = file === drawer ? full.slice(full.indexOf("function DealDrawer("), full.indexOf("// Debit Note Drawer")) : full;
    const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    function visit(n: ts.Node) { if (ts.isJsxText(n)) assert.doesNotMatch(n.text.trim(), /[A-Za-z]/, n.text); ts.forEachChild(n, visit); }
    visit(ast); assert.doesNotMatch(source, /toast\.error\(err|setError\(err|\.then\(\(r\) => r\.json\(\)\)/);
  }
});
