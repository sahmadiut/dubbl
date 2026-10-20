import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { createElement, type ComponentType, type ReactNode } from "react";
import * as React from "react";
import * as nextIntl from "next-intl";
import { createTranslator } from "next-intl";
import ts from "typescript";
import { warehouseJson } from "../i18n/warehouse-presentation";
import * as BrandLoader from "../components/dashboard/brand-loader";
import { renderWithPresentation } from "./helpers/presentation";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";

const page = "app/(dashboard)/inventory/warehouses/page.tsx";
const picker = "components/dashboard/warehouse-picker.tsx";
const drawer = "components/dashboard/create-drawer.tsx";
const locales = ["en-US", "fa-IR"] as const;
const noop = () => {};
const caller = '<script>caller & location</script>';
const root = { id: "wh-a", name: caller, code: "WH-001", address: caller, isActive: true, isDefault: true };
const child = { ...root, id: "wh-b", name: "Inactive", code: "WH-002", isActive: false, isDefault: false };
const rows = { data: [root, child] };
const escape = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#x27;");
function translator(locale: typeof locales[number]) { return createTranslator({ locale, messages: locale === "en-US" ? en : fa, namespace: "Warehouses" }); }
function parse(file: string) { return ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX); }
type Captured = { kind: string; props: Record<string, unknown> };

// Production templates/controls and next-intl; controlled hooks and inline
// portal boundaries expose forms and callbacks without mounting a browser.
function loaded(file: string, states: Record<string, unknown> = {}, captured: Captured[] = [], events: unknown[] = []) {
  const ast = parse(file), name = file === page ? "WarehousesPage" : file === picker ? "WarehousePicker" : "WarehouseDrawer";
  const component = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === name)!;
  const names: string[] = [];
  function hooks(n: ts.Node) {
    if (ts.isVariableDeclaration(n) && ts.isArrayBindingPattern(n.name) && n.initializer && ts.isCallExpression(n.initializer) && n.initializer.expression.getText(ast) === "useState") names.push(n.name.elements[0].getText(ast));
    ts.forEachChild(n, hooks);
  }
  hooks(component);
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
  const inline = (kind: string) => function Inline(props: Record<string, unknown>) {
    captured.push({ kind, props });
    return createElement("div", { "data-control": kind, "data-value": props.value as string }, props.children as ReactNode,
      typeof props.placeholder === "string" ? createElement("span", null, props.placeholder) : null);
  };
  let index = 0;
  const require = createRequire(resolve(file)), compiled = { exports: {} as Record<string, ComponentType<Record<string, unknown>>> };
  const load = (id: string): unknown => {
    if (id === "react") return { ...React, useState: (initial: unknown) => { const key = names[index++]; return [Object.hasOwn(states, key) ? states[key] : initial, (v: unknown) => events.push([key, v])]; }, useEffect: noop, useRef: (v: unknown) => ({ current: v }), useCallback: (fn: unknown) => fn };
    if (id === "next-intl") return nextIntl;
    if (id === "next/navigation") return { usePathname: () => "/inventory", useRouter: () => ({ push: noop }) };
    if (id.endsWith("/create-drawer")) return { useCreateDrawer: () => ({ open: (kind: string) => events.push(kind) }) };
    if (id.endsWith("/use-confirm")) return { useConfirm: () => ({ confirm: noop, dialog: null }) };
    if (id.endsWith("/use-debounce")) return { useDebounce: (v: string) => states.debouncedSearch ?? v };
    if (id.endsWith("/use-document-title")) return { useDocumentTitle: (v: string) => events.push(v) };
    if (id.endsWith("/brand-loader")) return BrandLoader;
    for (const [suffix, names] of Object.entries({ "/ui/select": ["Select", "SelectContent", "SelectItem", "SelectTrigger", "SelectValue"], "/ui/tabs": ["Tabs", "TabsList", "TabsTrigger"], "/ui/sheet": ["Sheet", "SheetContent", "SheetHeader", "SheetTitle", "SheetDescription", "SheetFooter"], "/ui/popover": ["Popover", "PopoverContent", "PopoverTrigger"], "/ui/command": ["Command", "CommandEmpty", "CommandGroup", "CommandInput", "CommandItem", "CommandList"] })) {
      if (id.endsWith(suffix)) return Object.fromEntries(names.map(key => [key, inline(key)]));
    }
    return require(id.startsWith("@/") ? resolve(id.slice(2)) : id);
  };
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  new Function("require", "module", "exports", code)(load, compiled, compiled.exports);
  return compiled.exports[name];
}

function callback(file: string, name: string, scope: Record<string, unknown> = {}) {
  const ast = parse(file); let expression = "";
  function visit(n: ts.Node) {
    if (ts.isFunctionDeclaration(n) && n.name?.text === name) expression = n.getText(ast);
    if (ts.isVariableDeclaration(n) && n.name.getText(ast) === name && n.initializer && ts.isCallExpression(n.initializer)) expression = n.initializer.arguments[0].getText(ast);
    ts.forEachChild(n, visit);
  }
  const owner = file === drawer ? ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === "WarehouseDrawer")! : ast;
  visit(owner); assert.ok(expression, name);
  const code = ts.transpileModule(`const run = ${expression};`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  return new Function(...Object.keys(scope), `${code}; return run;`)(...Object.values(scope));
}
const event = { preventDefault: noop, stopPropagation: noop, currentTarget: {} };
const flush = async () => { for (let i = 0; i < 6; i++) await new Promise(resolve => setImmediate(resolve)); };

test("warehouse page renders bilingual cards, nullable flags, edit fields, stats and canonical sort/filter codes", () => {
  for (const locale of locales) for (const saving of [false, true]) {
    const t = translator(locale), captured: Captured[] = [], events: unknown[] = [];
    const Page = loaded(page, { warehouses: rows.data, loading: false, sheetOpen: true, editing: root, saving, search: "WH-", formName: caller, formCode: root.code, formAddress: caller }, captured, events);
    const html = renderWithPresentation(createElement(Page), locale);
    for (const key of ["title", "description", "overview", "defaultWarehouse", "editWarehouse", "cancel", saving ? "saving" : "saveChanges", "delete", "setDefault"] as const) assert.ok(html.includes(escape(t(key))), key);
    assert.ok(html.includes(escape(caller)) && !html.includes("<script>"));
    assert.ok(html.includes(escape(t("activeCount", { count: 1 }))));
    assert.ok(html.includes(escape(t("inactiveCount", { count: 1 }))));
    assert.deepEqual(captured.filter(c => c.kind === "SelectItem").map(c => c.props.value), ["name", "code", "default"]);
    assert.deepEqual(captured.filter(c => c.kind === "TabsTrigger").map(c => c.props.value), ["all", "active", "inactive"]);
    assert.ok(events.includes(t("documentTitle")));
    assert.ok(html.includes(`aria-label="${escape(t("clearSearch"))}"`) && html.includes(`aria-label="${escape(t("toggleSort"))}"`));
    assert.equal((html.match(new RegExp(`>${escape(t("delete"))}<`, "g")) || []).length, 1);
  }
});

test("warehouse empty/help, filtered absence and loading states use real catalogs", () => {
  for (const locale of locales) {
    const t = translator(locale), events: unknown[] = [];
    const Page = loaded(page, { loading: false }, [], events);
    const html = renderWithPresentation(createElement(Page), locale);
    for (const key of ["emptyDescription", "newWarehouse", "exampleWarehouse", "mainWarehouse", "exampleAddress", "trackingTitle", "transfersDescription", "countsDescription"] as const) assert.ok(html.includes(escape(t(key))), key);
    assert.ok(html.includes("WH-001") && html.includes("$12,400"));
    const action = callback(page, "openEdit", { setEditing: noop, setFormName: noop, setFormCode: noop, setFormAddress: noop, setSheetOpen: noop });
    action(root);
    for (const [states, key] of [[{ warehouses: [child], statusFilter: "active" }, "noFilterMatches"], [{ warehouses: rows.data, search: "missing" }, "trySearch"]] as const) {
      const Filtered = loaded(page, { loading: false, ...states });
      assert.ok(renderWithPresentation(createElement(Filtered), locale).includes(escape(t(key))));
    }
    const Loading = loaded(page);
    assert.ok(!renderWithPresentation(createElement(Loading), locale).includes(escape(t("emptyDescription"))));
  }
});

test("warehouse drawer uses translated shared footer, canonical form names and busy state", () => {
  for (const locale of locales) for (const saving of [false, true]) {
    const t = translator(locale), Drawer = loaded(drawer, { saving });
    const html = renderWithPresentation(createElement(Drawer, { open: true, onClose: noop }), locale);
    for (const key of ["newWarehouse", "createDescription", "warehouseInfo", "nameRequired", "codeRequired", "location", "address", "optionalAddress", "cancel", saving ? "creating" : "createWarehouse"] as const) assert.ok(html.includes(escape(t(key))), key);
    for (const field of ["name", "code", "address"]) assert.ok(html.includes(`name="${field}"`));
    assert.ok(html.includes('placeholder="WH-001"'));
    assert.equal(/<button(?=[^>]*type="submit")(?=[^>]*disabled="")/.test(html), saving);
  }
});

test("warehouse picker renders catalogs, caller override, default badge and canonical selection including deselection", () => {
  for (const locale of locales) {
    const t = translator(locale);
    for (const value of ["", root.id]) {
      const captured: Captured[] = [], events: unknown[] = [];
      const Picker = loaded(picker, { warehouses: rows.data }, captured, events);
      const html = renderWithPresentation(createElement(Picker, { value, onChange: (v: string) => events.push(v) }), locale);
      assert.ok(html.includes(escape(t("searchWarehouses"))) && html.includes(escape(t("defaultMarker"))));
      assert.ok(html.includes(escape(caller)) && !html.includes("<script>"));
      assert.deepEqual(captured.filter(c => c.kind === "CommandItem").map(c => c.props.value), [root.id, child.id]);
      (captured.find(c => c.kind === "CommandItem")!.props.onSelect as () => void)();
      assert.deepEqual(events.slice(-3), [value ? "" : root.id, ["open", false], ["search", ""]]);
    }
    for (const [states, key] of [[{}, "noWarehouses"], [{ search: "missing" }, "noSearchMatches"], [{ readFailed: true }, "readFailed"]] as const) {
      const Picker = loaded(picker, states);
      assert.ok(renderWithPresentation(createElement(Picker, { value: "", onChange: noop }), locale).includes(escape(t(key))));
    }
    const Custom = loaded(picker);
    assert.ok(renderWithPresentation(createElement(Custom, { value: "", onChange: noop, placeholder: caller }), locale).includes(escape(caller)));
    const Default = loaded(picker);
    assert.ok(renderWithPresentation(createElement(Default, { value: "", onChange: noop }), locale).includes(escape(t("selectWarehouse"))));
  }
});

test("warehouse response validators preserve historical nullable flags and reject malformed fields, status and JSON", async () => {
  const historical = { ...root, isActive: null, isDefault: null, address: null };
  assert.deepEqual(await warehouseJson(Response.json({ data: [historical] }), "list"), { data: [historical] });
  assert.deepEqual(await warehouseJson(Response.json({ warehouse: root }), "warehouse"), { warehouse: root });
  assert.deepEqual(await warehouseJson(Response.json({ success: true }), "delete"), { success: true });
  for (const kind of ["list", "warehouse", "delete"] as const) {
    const read = warehouseJson as (res: Response, kind: string) => Promise<unknown>;
    for (const payload of [null, {}, { data: [null] }, { data: {} }, { warehouse: {} }, { success: false }]) await assert.rejects(read(Response.json(payload), kind));
    await assert.rejects(read(new Response("private parser text"), kind));
    await assert.rejects(read(Response.json(rows, { status: 403 }), kind));
  }
  for (const field of ["id", "name", "code", "address", "isDefault", "isActive"]) for (const value of [undefined, 123, {}]) {
    await assert.rejects(warehouseJson(Response.json({ data: [{ ...root, [field]: value }] }), "list"));
    await assert.rejects(warehouseJson(Response.json({ warehouse: { ...root, [field]: value } }), "warehouse"));
  }
});

test("warehouse reads retain prior state on failures, end loading without org and suppress stale results", async () => {
  for (const locale of locales) for (const mode of ["success", "status", "json", "shape", "network", "no-org", "stale"]) {
    const t = translator(locale), events: unknown[] = [], fetchIdRef = { current: 0 };
    const set = (key: string) => (v: unknown) => events.push([key, v]);
    await callback(page, "fetchWarehouses", { t, warehouseJson, orgId: mode === "no-org" ? null : "org-a", fetchIdRef, setWarehouses: set("rows"), setLoading: set("loading"), setRefetching: set("refresh"), setFetchKey: noop, toast: { error: set("error") },
      fetch: async (url: string, init: RequestInit) => {
        assert.equal(url, "/api/v1/warehouses"); assert.deepEqual(init.headers, { "x-organization-id": "org-a" });
        if (mode === "stale") ++fetchIdRef.current;
        if (mode === "network") throw Error("private");
        return mode === "json" ? new Response("private") : Response.json(mode === "shape" ? { data: [{}] } : rows, { status: mode === "status" ? 403 : 200 });
      } })();
    assert.deepEqual(events, mode === "no-org" ? [["loading", false], ["refresh", false]] : mode === "stale" ? [["refresh", true]] : mode === "success" ? [["refresh", true], ["rows", rows.data], ["loading", false], ["refresh", false]] : [["refresh", true], ["error", t("readFailed")], ["loading", false], ["refresh", false]]);
  }
});

test("warehouse create and edit callbacks keep scoped location payloads and retain forms on failed verification", async () => {
  for (const locale of locales) for (const file of [page, drawer]) for (const edit of file === page ? [false, true] : [false]) for (const mode of ["success", "status", "json", "shape", "network", "no-org"]) {
    const t = translator(locale), events: unknown[] = [];
    class Form { get(key: string) { return key === "name" ? caller : key === "code" ? "WH-001" : ""; } }
    const set = (key: string) => (v: unknown) => events.push([key, v]);
    await callback(file, file === drawer ? "handleSubmit" : "handleSave", { t, warehouseJson, FormData: Form, orgId: mode === "no-org" ? null : "org-a", localStorage: { getItem: () => mode === "no-org" ? null : "org-a" }, editing: edit ? root : null, formName: caller, formCode: root.code, formAddress: "", setSaving: set("busy"), setEditing: set("edit"), setSheetOpen: set("open"), onClose: () => events.push("close"), window: { dispatchEvent: (e: Event) => events.push(e.type) }, fetchWarehouses: () => events.push("refresh"), toast: { success: set("success"), error: set("error") },
      fetch: async (url: string, init: RequestInit) => {
        assert.equal(url, `/api/v1/warehouses${edit ? "/" + root.id : ""}`); assert.equal(init.method, edit ? "PATCH" : "POST");
        assert.deepEqual(init.headers, { "Content-Type": "application/json", "x-organization-id": "org-a" });
        assert.deepEqual(JSON.parse(init.body as string), { name: caller, code: root.code, address: null });
        if (mode === "network") throw Error("private");
        return mode === "json" ? new Response("private") : Response.json({ warehouse: mode === "shape" ? {} : root }, { status: mode === "status" ? 403 : 200 });
      } })(event);
    assert.deepEqual(events, mode === "no-org" ? [["error", t("organizationRequired")]] : mode !== "success" ? [["busy", true], ["error", t(edit ? "updateFailed" : "createFailed")], ["busy", false]] : [["busy", true], ["success", t(edit ? "updated" : "created")], ...(file === drawer ? ["close", "refetch-warehouses"] : [["open", false], ["edit", null], "refresh"]), ["busy", false]]);
  }
});

test("warehouse delete confirmation/cancel and default callbacks preserve ID/boolean contracts and localize failures", async () => {
  for (const locale of locales) for (const name of ["handleDelete", "handleSetDefault"]) for (const mode of ["success", "status", "shape", "network", "cancel", "no-org"]) {
    const t = translator(locale), events: unknown[] = [], deleting = name === "handleDelete";
    await callback(page, name, { t, warehouseJson, orgId: mode === "no-org" ? null : "org-a", confirm: async (options: unknown) => { assert.deepEqual(options, { title: t("deleteTitle", { name: caller }), description: t("deleteDescription"), confirmLabel: t("delete"), cancelLabel: t("cancel"), destructive: true }); return mode !== "cancel"; }, fetchWarehouses: () => events.push("refresh"), toast: { success: (v: string) => events.push(v), error: (v: string) => events.push(v) },
      fetch: async (url: string, init: RequestInit) => {
        assert.equal(url, "/api/v1/warehouses/wh-a"); assert.equal(init.method, deleting ? "DELETE" : "PATCH");
        assert.equal((init.headers as Record<string, string>)["x-organization-id"], "org-a");
        if (!deleting) assert.deepEqual(JSON.parse(init.body as string), { isDefault: true });
        if (mode === "network") throw Error("private");
        return Response.json(mode === "shape" ? {} : deleting ? { success: true } : { warehouse: root }, { status: mode === "status" ? 409 : 200 });
      } })(root);
    assert.deepEqual(events, mode === "no-org" ? [t("organizationRequired")] : deleting && mode === "cancel" ? [] : ["status", "shape", "network"].includes(mode) ? [t(deleting ? "deleteFailed" : "defaultFailed")] : ["refresh", deleting ? t("deleted") : t("defaultSet", { name: caller })]);
  }
});

test("warehouse picker read lifecycle checks org/status/shape and suppresses closed or superseded results", async () => {
  for (const mode of ["success", "status", "shape", "network", "no-org", "close", "stale"]) {
    const events: unknown[] = [], fetchIdRef = { current: 0 }, set = (key: string) => (v: unknown) => events.push([key, v]);
    const run = callback(picker, "handleOpenChange", { warehouseJson, orgId: mode === "no-org" ? null : "org-a", fetchIdRef, setOpen: set("open"), setReadFailed: set("error"), setWarehouses: set("rows"), setFetchCount: noop,
      fetch: async () => { if (mode === "stale") ++fetchIdRef.current; if (mode === "network") throw Error("private"); return Response.json(mode === "shape" ? { data: [{}] } : rows, { status: mode === "status" ? 403 : 200 }); } });
    run(true); if (mode === "close") run(false); await flush();
    assert.deepEqual(events, mode === "no-org" ? [["open", true], ["error", true]] : mode === "close" ? [["open", true], ["error", false], ["open", false]] : mode === "stale" ? [["open", true], ["error", false]] : mode === "success" ? [["open", true], ["error", false], ["rows", rows.data]] : [["open", true], ["error", false], ["error", true]]);
  }
});

test("all warehouse Persian messages contain Persian script and preserve interpolation contracts", () => {
  assert.deepEqual(Object.keys(en.Warehouses), Object.keys(fa.Warehouses));
  for (const [key, value] of Object.entries(fa.Warehouses)) assert.match(value, /[\u0600-\u06ff]/, key);
  for (const locale of locales) {
    const t = translator(locale);
    for (const count of [0, 1, 2, 2147483647]) assert.ok(!/MISSING|INVALID/.test(t("withAddressCount", { count })));
    assert.ok(t("deleteTitle", { name: caller }).includes(caller));
  }
});

test("warehouse source audit leaves only the explicit sample identifier as authored visible text", () => {
  for (const file of [page, picker, drawer]) {
    const ast = parse(file);
    const owner = file === drawer ? ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === "WarehouseDrawer")! : ast;
    function audit(n: ts.Node) {
      if (ts.isJsxText(n) && /[A-Za-z]/.test(n.text)) assert.equal(n.text.trim(), "WH-001", `${file}: ${n.text}`);
      if (ts.isJsxAttribute(n) && ["placeholder", "title", "aria-label"].includes(n.name.getText(ast)) && n.initializer && ts.isStringLiteral(n.initializer)) assert.equal(n.initializer.text, "WH-001");
      ts.forEachChild(n, audit);
    }
    audit(owner);
  }
});

test("warehouse filtering retains active/inactive truthiness, address search and sort order without changing IDs", () => {
  const historical = { ...root, id: "wh-c", name: "Historical", code: "WH-003", isDefault: null, isActive: null, address: "Remote yard" };
  for (const locale of locales) for (const [states, expected] of [
    [{ statusFilter: "active" }, [root.id]],
    [{ statusFilter: "inactive" }, [historical.id, child.id]],
    [{ search: "REMOTE" }, [historical.id]],
    [{ sortBy: "code", sortOrder: "desc" }, [historical.id, child.id, root.id]],
    [{ sortBy: "default", sortOrder: "desc" }, [root.id, child.id, historical.id]],
  ] as const) {
    const captured: Captured[] = [];
    const Page = loaded(page, { loading: false, warehouses: [root, child, historical], ...states }, captured);
    const html = renderWithPresentation(createElement(Page), locale);
    // Visible card codes prove order without translating stored identifiers.
    let previous = -1;
    for (const id of expected) {
      const row = [root, child, historical].find(row => row.id === id)!;
      const marker = `text-xs text-muted-foreground font-mono">${row.code}</p>`;
      const index = html.indexOf(marker);
      assert.ok(index > previous, `${id}/${JSON.stringify(states)}`); previous = index;
    }
    for (const row of [root, child, historical]) if (!expected.includes(row.id)) assert.ok(!html.includes(`text-xs text-muted-foreground font-mono">${row.code}</p>`));
  }
});
