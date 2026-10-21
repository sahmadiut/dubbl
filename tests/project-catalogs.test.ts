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
import * as DataTable from "../components/dashboard/data-table";
import { projectListJson, projectMutationJson, projectStatusKeys, projectPriorityKeys } from "../i18n/project-presentation";
import { projectMoneyDisplay } from "../lib/money/project-display";
import { renderWithPresentation } from "./helpers/presentation";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";

const page = "app/(dashboard)/projects/page.tsx", settings = "app/(dashboard)/projects/[id]/settings/page.tsx", drawer = "components/dashboard/create-drawer.tsx";
const locales = ["en-US", "fa-IR"] as const;
type Locale = typeof locales[number];
const caller = "<script>caller & name</script>";
const project = { id: "project-a", name: caller, status: "active", priority: "high", billingType: "hourly", color: "#10b981", currency: "KWD",
  budget: Number.MAX_SAFE_INTEGER, budgetMinor: String(Number.MAX_SAFE_INTEGER), hourlyRate: 29, hourlyRateMinor: "29", fixedPrice: 0, fixedPriceMinor: "0",
  totalBilled: 29, totalBilledMinor: "29", totalHours: 95, estimatedHours: 120, contact: { name: caller }, contactId: "contact-a", tags: [caller],
  category: caller, description: caller, startDate: "2026-10-01", endDate: "2026-10-31", enableTasks: true, enableTimeTracking: true,
  enableMilestones: false, enableNotes: true, enableBilling: true,
  members: [{ id: "link-a", role: "manager", member: { id: "member-a", user: { name: caller, email: "person@example.test", image: null } } }] };
const translator = (locale: Locale) => createTranslator({ locale, messages: locale === "en-US" ? en : fa, namespace: "Projects" });
const escape = (v: string) => v.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#x27;");
type Capture = { kind: string; props: Record<string, unknown> };
type Harness = { captured: Capture[]; events: unknown[]; effects: (() => void | (() => void))[] };

// Production JSX, next-intl, table, footer and money inputs; control hook/IO state and portals.
function render(file: string, states: Record<string, unknown> = {}, locale: Locale = "en-US") {
  const ast = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const name = file === page ? "ProjectsPage" : file === settings ? "SettingsPage" : "ProjectDrawer";
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
  const h: Harness = { captured: [], events: [], effects: [] };
  const capture = (factory: typeof jsx.jsx) => (kind: unknown, props: Record<string, unknown>, key: string) => {
    h.captured.push({ kind: typeof kind === "string" ? kind : (kind as { name?: string })?.name ?? "", props });
    return factory(kind as Parameters<typeof jsx.jsx>[0], props, key);
  };
  const inline = (kind: string) => function Inline(props: Record<string, unknown>) {
    h.captured.push({ kind, props });
    return createElement("div", { "data-control": kind }, props.children as ReactNode,
      typeof props.placeholder === "string" ? createElement("span", null, props.placeholder) : null);
  };
  let index = 0;
  const require = createRequire(resolve(file)), compiled = { exports: {} as Record<string, ComponentType<Record<string, unknown>>> };
  const load = (id: string): unknown => {
    if (id === "react") return { ...React, useState: (initial: unknown) => {
      const key = names[index++]; return [Object.hasOwn(states, key) ? states[key] : initial, (v: unknown) => h.events.push([key, v])];
    }, useEffect: (fn: () => void | (() => void)) => h.effects.push(fn) };
    if (id === "react/jsx-runtime") return { ...jsx, jsx: capture(jsx.jsx), jsxs: capture(jsx.jsxs) };
    if (id === "next-intl") return nextIntl;
    if (id.endsWith("/brand-loader")) return BrandLoader;
    if (id.endsWith("/data-table")) return DataTable;
    if (id === "sonner") return { toast: { error: (v: unknown) => h.events.push(["error", v]), success: (v: unknown) => h.events.push(["success", v]) } };
    if (id === "next/navigation") return { useRouter: () => ({ push: (v: string) => h.events.push(["push", v]) }) };
    if (id.endsWith("/create-drawer")) return { useCreateDrawer: () => ({ open: (v: string) => h.events.push(["drawer", v]) }) };
    if (id === "../project-context") return { useProject: () => ({ project, orgId: "org-a", projectId: project.id, refresh: () => h.events.push(["refresh"]), ...(states.context as Record<string, unknown> | undefined) }), PROJECT_COLORS: ["#10b981", "#3b82f6"] };
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
function remove(h: Harness) { return (h.captured.find(c => c.kind === "Button" && c.props.variant === "destructive")!.props.onClick as () => Promise<void>)(); }
async function withIO(fetcher: typeof fetch, run: (events: string[]) => Promise<void>, org: string | null = "org-a", fields: Record<string, string> = {}, storageThrows = false) {
  const fetchValue = globalThis.fetch, formValue = globalThis.FormData;
  const descriptors = ["localStorage", "window"].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const), events: string[] = [];
  globalThis.fetch = fetcher;
  globalThis.FormData = class { get(key: string) { return fields[key] ?? null; } } as unknown as typeof FormData;
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: (key: string) => { assert.equal(key, "activeOrgId"); if (storageThrows) throw new Error("Private storage"); return org; } } });
  Object.defineProperty(globalThis, "window", { configurable: true, value: { dispatchEvent: (e: Event) => events.push(e.type) } });
  try { await run(events); } finally {
    globalThis.fetch = fetchValue; globalThis.FormData = formValue;
    for (const [key, d] of descriptors) if (d) Object.defineProperty(globalThis, key, d); else Reflect.deleteProperty(globalThis, key);
  }
}

test("project list renders bilingual headers, exact aggregates, hours, finite enums, escaped caller data and navigation", () => {
  for (const locale of locales) {
    const t = translator(locale), h = render(page, { loading: false, projects: [project, { ...project, id: "project-b" }] }, locale);
    assert.ok(has(h, "title", t("documentTitle")));
    for (const key of ["overview", "projects", "newProject", "project", "status", "priority", "time", "budget", "billed", "team", "totalBudget", "totalBilled", "hoursLogged", "teamMembers", "manageDescription"] as const) assert.ok(h.html.includes(escape(t(key))), key);
    assert.ok(h.html.includes(escape(caller)) && !h.html.includes("<script>"));
    assert.ok(h.html.includes(escape(projectMoneyDisplay(BigInt(Number.MAX_SAFE_INTEGER) * 2n, "KWD"))));
    assert.ok(h.html.includes(escape(t("hoursMinutes", { hours: 1, minutes: 35 }))));
    for (const [status, key] of Object.entries(projectStatusKeys)) assert.ok(render(page, { loading: false, projects: [{ ...project, status }] }, locale).html.includes(escape(t(key))));
    for (const [priority, key] of Object.entries(projectPriorityKeys)) assert.ok(render(page, { loading: false, projects: [{ ...project, priority }] }, locale).html.includes(escape(t(key))));
    const mixed = render(page, { loading: false, projects: [project, { ...project, id: "project-b", currency: "JPY" }] }, locale);
    assert.equal(mixed.captured.filter(c => c.kind === "StatCard" && c.props.value === t("multipleCurrencies")).length, 2);
    const table = h.captured.find(c => c.kind === "DataTable")!;
    (table.props.onRowClick as (p: unknown) => void)(project);
    assert.ok(has(h, "push", `/projects/${project.id}`));
    (h.captured.find(c => c.kind === "Button")!.props.onClick as () => void)(); assert.ok(has(h, "drawer", "project"));
    const tabs = h.captured.find(c => c.kind === "Tabs")!; (tabs.props.onValueChange as (v: string) => void)("on_hold"); assert.ok(has(h, "statusFilter", "on_hold"));
    assert.ok(render(page, { loading: false }, locale).html.includes(escape(t("noProjects"))));
    assert.ok(render(page, { loading: false, statusFilter: "archived" }, locale).html.includes(escape(t("noResults"))));
    assert.ok(render(page, {}, locale).html.includes("brand-loader"));
    for (const loadError of ["Private error", "organizationRequired"]) {
      const html = render(page, { loading: false, loadError }, locale).html;
      assert.ok(html.includes('role="alert"') && html.includes(escape(t(loadError === "organizationRequired" ? loadError : "loadFailed"))) && !html.includes("Private"));
    }
  }
});

test("project settings and drawer render paired copy, machine-valued options and saved exact inputs", () => {
  for (const locale of locales) for (const file of [settings, drawer]) {
    const t = translator(locale), h = render(file, {}, locale);
    for (const key of ["projectNameRequired", "client", "status", "priority", "category", "color", "tags", "billingType", "budget", "hourlyRate", "fixedPrice", "estimatedHours", "timeline", "description", "selectStart", "selectEnd"] as const) assert.ok(h.html.includes(escape(t(key))), key);
    assert.ok(h.captured.some(c => c.kind === "SelectItem" && c.props.value === "on_hold" && c.props.children === t("onHold")));
    assert.ok(h.captured.some(c => c.kind === "SelectItem" && c.props.value === "non_billable" && c.props.children === t("nonBillable")));
    const radio = h.captured.find(c => c.kind === "input" && c.props.type === "radio")!;
    assert.equal(radio.props["aria-label"], t("colorChoice", { color: "#10b981" }));
    assert.equal(radio.props.value, "#10b981");
    if (file === settings) {
      assert.ok(has(h, "title", t("settingsTitle")));
      assert.ok(h.captured.some(c => c.kind === "CurrencyInput" && c.props.value === "90071992547409.91" && c.props.prefix === "KWD"));
      assert.ok(h.html.includes(escape(caller)) && !h.html.includes("<script>"));
      assert.ok(render(file, { saving: true, deleting: true }, locale).html.includes(escape(t("saving"))));
      assert.equal(render(file, { context: { project: null } }, locale).html, "");
    } else {
      for (const key of ["newProject", "drawerDescription", "projectInfo", "financials", "createProject"] as const) assert.ok(h.html.includes(escape(t(key))), key);
      assert.ok(render(file, { saving: true }, locale).html.includes(escape((locale === "en-US" ? en : fa).DocumentForms.creating)));
    }
  }
});

test("project readers reject HTTP/JSON/envelope, exact alias, enum, minutes and identity corruption", async () => {
  assert.deepEqual(await projectListJson(Response.json({ data: [project] })), { data: [project] });
  for (const bad of [null, [], {}, { data: null }, { data: [null] }, { data: [project, project] }]) await assert.rejects(projectListJson(Response.json(bad)));
  for (const patch of [{ id: "" }, { name: null }, { budgetMinor: "29" }, { budget: undefined }, { billingType: "private" }, { currency: "usd" }, { status: "private" }, { priority: "private" }, { totalHours: 0.1 }, { estimatedHours: 2147483648 }, { members: null }, { members: [{}] }, { contact: {} }]) await assert.rejects(projectListJson(Response.json({ data: [{ ...project, ...patch }] })));
  assert.deepEqual(await projectMutationJson(Response.json({ project })), { project });
  assert.deepEqual(await projectMutationJson(Response.json({ success: true }), "delete"), { success: true });
  for (const body of [null, [], {}, { project: { id: "" } }, { project: { ...project, totalBilledMinor: "30" } }]) await assert.rejects(projectMutationJson(Response.json(body)));
  for (const body of [{}, { success: false }, { project }]) await assert.rejects(projectMutationJson(Response.json(body), "delete"));
  for (const read of [projectListJson, projectMutationJson]) {
    await assert.rejects(read(Response.json({ project, data: [project] }, { status: 403 })));
    await assert.rejects(read(new Response("Private JSON")));
  }
});

test("project list effect preserves organization/filter requests, validates adoption and ignores cleaned-up work", async () => {
  for (const statusFilter of ["all", "on_hold"]) await withIO(async (url, init) => {
    assert.equal(String(url), `/api/v1/projects?${statusFilter === "all" ? "" : "status=on_hold"}`);
    assert.deepEqual(init?.headers, { "x-organization-id": "org-a" }); return Response.json({ data: [project] });
  }, async () => {
    const h = render(page, { statusFilter }); h.effects[0](); await flush();
    assert.ok(has(h, "projects", [project]) && has(h, "loadError", "") && has(h, "loading", false));
    const cancelled = render(page, { statusFilter }); const cleanup = cancelled.effects[0]() as () => void; cleanup(); await flush();
    assert.deepEqual(cancelled.events.filter(v => (v as string[])[0] !== "title"), [["loading", true]]);
  });
  for (const mode of ["http", "json", "envelope", "money", "network", "org", "storage"]) await withIO(async () => {
    if (mode === "org" || mode === "storage") assert.fail("No org request");
    if (mode === "http") return Response.json({ error: "Private server" }, { status: 403 });
    if (mode === "json") return new Response("Private JSON");
    if (mode === "envelope") return Response.json({});
    if (mode === "money") return Response.json({ data: [{ ...project, budgetMinor: "29" }] });
    throw new Error("Private network");
  }, async () => {
    const h = render(page); h.effects[0](); await flush();
    assert.ok(has(h, "projects", []) && has(h, "loading", false) && has(h, "loadError", mode === "org" ? "organizationRequired" : "loadFailed"));
    assert.ok(!JSON.stringify(h.events).includes("Private"));
  }, mode === "org" ? null : "org-a", {}, mode === "storage");
});

const fields = { name: caller, description: caller, status: "on_hold", priority: "urgent", billingType: "non_billable", color: "#3b82f6", tags: "alpha, beta", category: caller,
  budget: "90071992547409.91", hourlyRate: "0.29", fixedPrice: "0", estimatedHours: "1.5", enableTasks: "on", enableTimeTracking: "on", enableNotes: "on", enableBilling: "on" };
const formStates = { contactId: "contact-a", startDate: "2026-10-01", endDate: "2026-10-31", projStartDate: "2026-10-01", projEndDate: "2026-10-31" };
test("create and settings save preserve cents strings, whole minutes, dates, flags and success event/navigation", async () => {
  for (const locale of locales) for (const file of [drawer, settings]) await withIO(async (url, init) => {
    assert.equal(url, "/api/v1/projects" + (file === settings ? "/project-a" : "")); assert.equal(init?.method, file === drawer ? "POST" : "PATCH");
    assert.deepEqual(init?.headers, { "Content-Type": "application/json", "x-organization-id": "org-a" });
    const body = JSON.parse(init!.body as string);
    assert.deepEqual(body, { name: caller, description: caller, contactId: "contact-a", status: "on_hold", priority: "urgent", billingType: "non_billable", color: "#3b82f6",
      budgetMinor: "9007199254740991", hourlyRateMinor: "29", fixedPriceMinor: "0", estimatedHours: 90, category: caller, tags: ["alpha", "beta"],
      startDate: "2026-10-01", endDate: "2026-10-31", enableTasks: true, enableTimeTracking: true, enableMilestones: false, enableNotes: true, enableBilling: true });
    return Response.json({ project }, { status: file === drawer ? 201 : 200 });
  }, async events => {
    const h = render(file, formStates, locale); await submit(h);
    assert.ok(has(h, "success", translator(locale)(file === drawer ? "created" : "updated")));
    assert.ok(has(h, "saving", false)); assert.deepEqual(events, ["projects-changed"]);
    if (file === drawer) assert.ok(has(h, "close") && has(h, "push", "/projects/project-a")); else assert.ok(has(h, "refresh"));
  }, "org-a", fields);
});

test("create/save failures keep fields and reject private diagnostics without closing, navigating or refreshing", async () => {
  for (const locale of locales) for (const file of [drawer, settings]) for (const mode of ["http", "json", "envelope", "money", "network", "input", "org", ...(file === drawer ? ["storage"] : [])]) await withIO(async () => {
    if (["org", "storage", "input"].includes(mode)) assert.fail("Unexpected mutation");
    if (mode === "http") return Response.json({ error: "Private server" }, { status: 409 });
    if (mode === "json") return new Response("Private parser");
    if (mode === "envelope") return Response.json({});
    if (mode === "money") return Response.json({ project: { ...project, budgetMinor: "29" } });
    throw new Error("Private network");
  }, async events => {
    const h = render(file, { ...formStates, ...(mode === "org" ? { context: { orgId: null } } : {}), ...(mode === "input" ? { projBudget: "-1" } : {}) }, locale);
    await submit(h);
    assert.ok(has(h, "error", translator(locale)(mode === "org" ? "organizationRequired" : file === drawer ? "createFailed" : "updateFailed")));
    if (file === drawer || mode !== "org") assert.ok(has(h, "saving", false));
    assert.ok(!h.events.some(v => ["success", "close", "push", "refresh", "contactId", "projBudget"].includes((v as string[])[0])));
    assert.deepEqual(events, []); assert.ok(!JSON.stringify(h.events).includes("Private"));
  }, mode === "org" ? null : "org-a", mode === "input" ? { ...fields, budget: "-1" } : fields, mode === "storage");
});

test("delete confirms in the selected language and reports success only after a checked response", async () => {
  for (const locale of locales) for (const mode of ["success", "cancel", "org", "http", "json", "envelope", "network"]) await withIO(async (url, init) => {
    assert.ok(!["cancel", "org"].includes(mode)); assert.equal(url, "/api/v1/projects/project-a"); assert.equal(init?.method, "DELETE");
    assert.deepEqual(init?.headers, { "x-organization-id": "org-a" });
    if (mode === "http") return Response.json({ error: "Private server" }, { status: 409 });
    if (mode === "json") return new Response("Private parser");
    if (mode === "envelope") return Response.json({ success: false });
    if (mode === "network") throw new Error("Private network");
    return Response.json({ success: true });
  }, async events => {
    const t = translator(locale), h = render(settings, { confirmed: mode !== "cancel", context: mode === "org" ? { orgId: null } : {} }, locale);
    await remove(h);
    assert.ok(has(h, "confirm", { title: t("deleteTitle"), description: t("deleteConfirm"), confirmLabel: t("delete"), destructive: true }));
    if (mode === "success") { assert.ok(has(h, "success", t("deleted")) && has(h, "push", "/projects")); assert.deepEqual(events, ["projects-changed"]); }
    else { assert.deepEqual(events, []); assert.ok(!has(h, "push", "/projects") && !has(h, "success", t("deleted"))); if (mode !== "cancel") assert.ok(has(h, "error", t(mode === "org" ? "organizationRequired" : "deleteFailed"))); }
    if (!["cancel", "org"].includes(mode)) assert.ok(has(h, "deleting", false));
    assert.ok(!JSON.stringify(h.events).includes("Private"));
  });
});

test("owned project copy is extracted with paired Persian script and explicit symbol/numeric exceptions", () => {
  for (const file of [page, settings, drawer]) {
    const ast = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const owner = file === drawer ? ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === "ProjectDrawer")! : ast;
    function visit(n: ts.Node) {
      if (ts.isJsxText(n)) assert.doesNotMatch(n.text, /[A-Za-z]/, n.text.trim());
      if (ts.isJsxAttribute(n) && ["title", "label", "description", "placeholder", "aria-label", "emptyMessage"].includes(n.name.getText(ast)) && n.initializer && ts.isStringLiteral(n.initializer)) assert.equal(n.initializer.text, "0", n.getText(ast));
      ts.forEachChild(n, visit);
    }
    visit(owner); assert.doesNotMatch(owner.getText(ast), /error\.message|err\.message|data\.error|\.json\(\)/);
  }
  assert.deepEqual(Object.keys(en.Projects), Object.keys(fa.Projects));
  for (const value of Object.values(fa.Projects)) assert.match(value, /[\u0600-\u06ff]/);
});
