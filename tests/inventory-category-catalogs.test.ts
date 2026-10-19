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
import { categoryJson } from "../i18n/inventory-category-presentation";
import * as BrandLoader from "../components/dashboard/brand-loader";
import { renderWithPresentation } from "./helpers/presentation";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";

const page = "app/(dashboard)/inventory/categories/page.tsx";
const picker = "components/dashboard/category-picker.tsx";
const drawer = "components/dashboard/create-drawer.tsx";
const layout = "app/(dashboard)/inventory/layout.tsx";
const locales = ["en-US", "fa-IR"] as const;
const noop = () => {};
const caller = '<script>کالا & category</script>';
const root = { id: "root-a", name: caller, color: "#10b981", description: caller, parentId: null };
const child = { ...root, id: "child-a", parentId: root.id };
const other = { ...root, id: "root-b", name: "Other root" };
const rows = { data: [{ ...root, children: [child] }, other], flat: [root, child, other] };
const escape = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#x27;");
function translator(locale: typeof locales[number]) { return createTranslator({ locale, messages: locale === "en-US" ? en : fa, namespace: "InventoryCategories" }); }
function parse(file: string) { return ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX); }
type Captured = { kind: string; props: Record<string, unknown> };

// Production templates/controls and next-intl; controlled hooks and inline
// portal boundaries expose forms and callbacks without mounting a browser.
function loaded(file: string, states: Record<string, unknown> = {}, captured: Captured[] = [], events: unknown[] = []) {
  const ast = parse(file), name = file === page ? "CategoriesPage" : file === picker ? "CategoryPicker" : file === drawer ? "CategoryDrawer" : "InventoryLayout";
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
      if (ts.isVariableStatement(n) && n.declarationList.declarations.some(d => d.name.getText(ast) === "CATEGORY_COLORS")) return [n.getText(ast)];
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
    if (id.endsWith("/tab-layout")) {
      const nested = { exports: {} };
      new Function("require", "module", "exports", ts.transpileModule(readFileSync("components/dashboard/tab-layout.tsx", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText)(load, nested, nested.exports);
      return nested.exports;
    }
    for (const [suffix, names] of Object.entries({ "/ui/sheet": ["Sheet", "SheetContent", "SheetHeader", "SheetTitle", "SheetDescription", "SheetFooter"], "/ui/popover": ["Popover", "PopoverContent", "PopoverTrigger"], "/ui/command": ["Command", "CommandEmpty", "CommandGroup", "CommandInput", "CommandItem", "CommandList"] })) {
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
  const owner = file === drawer ? ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === "CategoryDrawer")! : ast;
  visit(owner); assert.ok(expression, name);
  const code = ts.transpileModule(`const run = ${expression};`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  return new Function(...Object.keys(scope), `${code}; return run;`)(...Object.values(scope));
}
const event = { preventDefault: noop, stopPropagation: noop, currentTarget: {} };
const flush = async () => { for (let i = 0; i < 6; i++) await new Promise(resolve => setImmediate(resolve)); };

test("category page renders bilingual tree, count, edit/create form, root eligibility and accessible actions", () => {
  for (const locale of locales) for (const saving of [false, true]) for (const editCategory of [null, root]) {
    const t = translator(locale), events: unknown[] = [];
    const Page = loaded(page, { categories: rows.data, flat: rows.flat, loading: false, editOpen: true, editCategory, saving }, [], events);
    const html = renderWithPresentation(createElement(Page), locale);
    for (const key of ["newCategory", editCategory ? "editCategory" : "newCategory", "nameRequired", "color", "parentCategory", "root", "description", "cancel", saving ? "saving" : editCategory ? "update" : "create"] as const) assert.ok(html.includes(escape(t(key))), key);
    assert.ok(html.includes(escape(t("count", { count: 3 }))));
    assert.ok(html.includes('name="parentId"') && html.includes('<option value="root-b">'));
    assert.equal(html.includes('<option value="root-a"'), !editCategory);
    assert.ok(!html.includes('<option value="child-a"'));
    assert.equal(/<button(?=[^>]*type="submit")(?=[^>]*disabled="")/.test(html), saving);
    assert.ok(html.includes(escape(caller)) && !html.includes("<script>"));
    assert.ok(html.includes(`aria-label="${escape(t("editCategory"))}"`) && html.includes(`aria-label="${escape(t("colorValue", { color: root.color }))}"`));
    assert.ok(events.includes(t("documentTitle")));
  }
});

test("empty category page keeps first-category form mounted and action reachable; loading stays separate", () => {
  for (const locale of locales) {
    const t = translator(locale), events: unknown[] = [], captured: Captured[] = [];
    const Page = loaded(page, { loading: false }, captured, events);
    const html = renderWithPresentation(createElement(Page), locale);
    for (const key of ["emptyTitle", "emptyDescription", "newCategory", "nameRequired", "create"] as const) assert.ok(html.includes(escape(t(key))), key);
    assert.ok(captured.some(c => c.kind === "Sheet"));
    const Loading = loaded(page);
    assert.ok(!renderWithPresentation(createElement(Loading), locale).includes(escape(t("emptyTitle"))));
    for (const count of [0, 1, 2]) assert.ok(!/MISSING|INVALID/.test(t("count", { count })));
    if (locale === "en-US") assert.equal(t("count", { count: 1 }), "1 category");
  }
});

test("picker renders translated placeholders, parent search, caller overrides, edit busy state and canonical selection", () => {
  for (const locale of locales) {
    const t = translator(locale), captured: Captured[] = [], events: unknown[] = [];
    const Picker = loaded(picker, { categories: rows.flat, editCategory: child, saving: true, search: "Other", debouncedSearch: "Other" }, captured, events);
    const html = renderWithPresentation(createElement(Picker, { value: root.id, onChange: (v: string) => events.push(v) }), locale);
    for (const key of ["searchCategories", "addCategory", "editCategory", "editDescription", "nameRequired", "optionalDescription", "cancel", "saving"] as const) assert.ok(html.includes(escape(t(key))), key);
    assert.ok(html.includes(escape(caller)) && !html.includes("<script>"));
    assert.deepEqual(captured.filter(c => c.kind === "CommandItem").map(c => c.props.value), [other.id]);
    (captured.find(c => c.kind === "CommandItem")!.props.onSelect as () => void)();
    assert.deepEqual(events.slice(-3), [other.id, ["open", false], ["search", ""]]);
    for (const [states, props, key] of [[{}, {}, "noCategories"], [{ search: "absent" }, {}, "noMatches"], [{ categories: [root, child], search: caller }, {}, "addCategory"]] as const) {
      const captured: Captured[] = [];
      const Picker = loaded(picker, states, captured);
      const html = renderWithPresentation(createElement(Picker, { value: "", onChange: noop, ...props }), locale);
      assert.ok(html.includes(escape(t(key))));
      if (!Object.hasOwn(states, "categories")) assert.ok(html.includes(escape(t("selectCategory"))));
      else assert.equal(captured.filter(c => c.kind === "CommandItem").length, 2);
    }
    const Custom = loaded(picker);
    assert.ok(renderWithPresentation(createElement(Custom, { value: "", onChange: noop, placeholder: caller }), locale).includes(escape(caller)));
    const Selected = loaded(picker, { categories: [root] }, captured, events);
    renderWithPresentation(createElement(Selected, { value: root.id, onChange: (v: string) => events.push(v) }), locale);
    (captured.filter(c => c.kind === "CommandItem").at(-1)!.props.onSelect as () => void)();
    assert.deepEqual(events.slice(-3), ["", ["open", false], ["search", ""]]);
  }
});

test("real CategoryDrawer and shared footer render translated pending/cancel labels and all color values", () => {
  for (const locale of locales) for (const saving of [false, true]) {
    const t = translator(locale), Drawer = loaded(drawer, { saving });
    const html = renderWithPresentation(createElement(Drawer, { open: true, onClose: noop }), locale);
    for (const key of ["newCategory", "createDescription", "categoryInfo", "nameRequired", "nameExample", "details", "color", "description", "optionalDescription", "cancel", saving ? "creating" : "createCategory"] as const) assert.ok(html.includes(escape(t(key))), key);
    assert.equal((html.match(/type="radio"/g) || []).length, 10);
    assert.ok(html.includes('name="name"') && html.includes('name="description"') && html.includes('value="#10b981"'));
    assert.equal(/<button(?=[^>]*type="submit")(?=[^>]*disabled="")/.test(html), saving);
  }
});

test("inventory navigation translates five tabs while retaining hrefs and exact root matching", () => {
  for (const locale of locales) {
    const t = createTranslator({ locale, messages: locale === "en-US" ? en : fa, namespace: "InventoryNavigation" });
    const Layout = loaded(layout), html = renderWithPresentation(createElement(Layout, null, "content"), locale);
    for (const [key, path] of [["items", ""], ["stocktakes", "/stock-takes"], ["locations", "/warehouses"], ["transfers", "/transfers"], ["stockValue", "/valuation"]] as const) assert.ok(html.includes(escape(t(key))) && html.includes(`href="/inventory${path}"`));
    assert.equal((html.match(/href="\/inventory/g) || []).length, 5);
    assert.match(readFileSync(layout, "utf8"), /href: "\/inventory", label: "items", icon: Package, exact: true/);
  }
});

test("category response validation rejects HTTP, JSON, malformed rows/envelopes and preserves caller data", async () => {
  assert.deepEqual(await categoryJson(Response.json(rows), "list"), rows);
  assert.deepEqual(await categoryJson(Response.json({ category: root }), "category"), { category: root });
  assert.deepEqual(await categoryJson(Response.json({ success: true }), "delete"), { success: true });
  for (const kind of ["list", "category", "delete"] as const) {
    // Select the overload at runtime to test the common boundary.
    const read = categoryJson as (response: Response, kind: string) => Promise<unknown>;
    for (const value of [null, {}, { data: [], flat: {} }, { data: [null], flat: [] }, { category: { ...root, name: 3 } }, { success: false }]) await assert.rejects(read(Response.json(value), kind));
    await assert.rejects(read(new Response("private prose"), kind));
    await assert.rejects(read(Response.json(rows, { status: 403 }), kind));
  }
  for (const bad of [{ ...root, parentId: 1 }, { ...root, color: undefined }, { ...root, description: {} }, { ...root, children: [{}] }]) await assert.rejects(categoryJson(Response.json({ data: [bad], flat: [root] }), "list"));
});

test("page read callback retains prior state on HTTP, malformed JSON, invalid rows and network failures", async () => {
  for (const locale of locales) for (const mode of ["success", "status", "json", "shape", "network", "no-org"]) {
    const t = translator(locale), events: unknown[] = [];
    await callback(page, "fetchCategories", { t, categoryJson, orgId: mode === "no-org" ? null : "org-a", setCategories: (v: unknown) => events.push(["tree", v]), setFlat: (v: unknown) => events.push(["flat", v]), setLoading: (v: unknown) => events.push(v), toast: { error: (v: string) => events.push(v) },
      fetch: async (url: string, init: RequestInit) => {
        assert.equal(url, "/api/v1/inventory/categories"); assert.deepEqual(init, { headers: { "x-organization-id": "org-a" } });
        if (mode === "network") throw new Error("private prose");
        if (mode === "json") return new Response("private prose");
        return Response.json(mode === "shape" ? { data: [null], flat: [] } : rows, { status: mode === "status" ? 403 : 200 });
      } })();
    assert.deepEqual(events, mode === "no-org" ? [false] : mode === "success" ? [["tree", rows.data], ["flat", rows.flat], false] : [t("readFailed"), false]);
  }
});

test("category create/edit callbacks retain scoped form payloads, reset only after success and localize failures", async () => {
  for (const locale of locales) for (const file of [page, picker, drawer]) for (const edit of file === page ? [false, true] : [file === picker]) for (const mode of ["success", "status", "json", "shape", "network", "no-org"]) {
    const t = translator(locale), events: unknown[] = [], fields = { name: caller, color: "", description: "", parentId: root.id };
    class Form { get(key: keyof typeof fields) { return fields[key]; } }
    const set = (key: string) => (v: unknown) => events.push([key, v]);
    const scope = { t, categoryJson, orgId: mode === "no-org" ? null : "org-a", editCategory: edit ? child : null, color: root.color, FormData: Form, setSaving: set("busy"), setEditOpen: set("open"), setEditCategory: set("edit"), setCategories: (fn: (rows: unknown[]) => unknown[]) => events.push(fn([child])), fetchCategories: () => events.push("refresh"), onClose: () => events.push("close"), localStorage: { getItem: () => mode === "no-org" ? null : "org-a" }, window: { dispatchEvent: (e: Event) => events.push(e.type) },
      toast: { success: (v: string) => events.push(v), error: (v: string) => events.push(v) },
      fetch: async (url: string, init: RequestInit) => {
        assert.equal(url, `/api/v1/inventory/categories${edit ? "/" + child.id : ""}`);
        assert.equal(init.method, edit ? "PATCH" : "POST");
        assert.deepEqual(init.headers, { "Content-Type": "application/json", "x-organization-id": "org-a" });
        assert.deepEqual(JSON.parse(init.body as string), { name: caller, color: file === drawer ? root.color : null, description: null, ...(file === page ? { parentId: root.id } : {}) });
        if (mode === "network") throw new Error("private prose");
        if (mode === "json") return new Response("private prose");
        return Response.json(mode === "shape" ? { category: {} } : { category: child }, { status: mode === "status" ? 403 : 200 });
      } };
    await callback(file, file === picker ? "handleEditSubmit" : "handleSubmit", scope)(event);
    const expected = mode === "no-org" ? [] : mode !== "success" ? [["busy", true], t(edit ? "updateFailed" : "createFailed"), ["busy", false]] : file === drawer ? [["busy", true], t("created"), "close", "refetch-categories", ["busy", false]] : file === page ? [["busy", true], t(edit ? "updated" : "created"), ["open", false], ["edit", null], "refresh", ["busy", false]] : [["busy", true], t("updated"), [child], ["open", false], ["edit", null], ["busy", false]];
    assert.deepEqual(events, expected, `${file}/${mode}`);
  }
});

test("delete callbacks require confirmed successful responses before clearing selection, refreshing or reporting success", async () => {
  for (const locale of locales) for (const file of [page, picker]) for (const mode of ["success", "unselected", "status", "json", "shape", "network", "cancel", "no-org"]) {
    const t = translator(locale), events: unknown[] = [];
    const run = callback(file, "handleDelete", { t, categoryJson, orgId: mode === "no-org" ? null : "org-a", value: mode === "unselected" ? other.id : child.id, confirm: async (options: unknown) => { assert.deepEqual(options, { title: t("deleteTitle", { name: child.name }), description: t("deleteDescription"), confirmLabel: t("delete"), destructive: true }); return mode !== "cancel"; },
      onChange: (v: string) => events.push(v), setCategories: (fn: (v: unknown[]) => unknown[]) => events.push(fn([root, child])), fetchCategories: () => events.push("refresh"), toast: { success: (v: string) => events.push(v), error: (v: string) => events.push(v) },
      fetch: async (url: string, init: RequestInit) => {
        assert.equal(url, `/api/v1/inventory/categories/${child.id}`); assert.deepEqual(init, { method: "DELETE", headers: { "x-organization-id": "org-a" } });
        if (mode === "network") throw new Error("private prose");
        if (mode === "json") return new Response("private prose");
        return Response.json({ success: mode !== "shape" }, { status: mode === "status" ? 409 : 200 });
      } });
    await (file === picker ? run(event, child) : run(child));
    assert.deepEqual(events, ["cancel", "no-org"].includes(mode) ? [] : ["success", "unselected"].includes(mode) ? file === page ? [t("deleted"), "refresh"] : [t("deleted"), ...(mode === "unselected" ? [] : [""]), [root]] : [t("deleteFailed")]);
  }
});

test("picker read suppresses stale response/error, preserves saved rows and balances pending count", async () => {
  for (const locale of locales) for (const mode of ["success", "status", "shape", "network", "stale", "stale-error", "no-org"]) {
    const t = translator(locale), events: unknown[] = [], ref = { current: 0 }; let pending = 0;
    callback(picker, "doFetch", { t, categoryJson, orgId: mode === "no-org" ? null : "org-a", fetchIdRef: ref, setFetchCount: (fn: (v: number) => number) => { pending = fn(pending); events.push(pending); }, setCategories: (v: unknown) => events.push(v), toast: { error: (v: string) => events.push(v) },
      fetch: async (url: string, init: RequestInit) => {
        assert.equal(url, "/api/v1/inventory/categories"); assert.deepEqual(init, { headers: { "x-organization-id": "org-a" } });
        if (mode.startsWith("stale")) ref.current++;
        if (["network", "stale-error"].includes(mode)) throw new Error("private prose");
        return Response.json(mode === "shape" ? { data: [], flat: [null] } : rows, { status: mode === "status" ? 403 : 200 });
      } })();
    await flush();
    assert.deepEqual(events, mode === "no-org" ? [] : ["stale", "stale-error"].includes(mode) ? [1, 0] : mode === "success" ? [1, rows.flat, 0] : [1, t("readFailed"), 0]);
    assert.equal(pending, 0);
  }
});

test("owned templates contain no authored untranslated display copy and Persian values contain Persian script", () => {
  for (const file of [page, picker, drawer, layout]) {
    const ast = parse(file);
    const nodes = file === drawer ? ast.statements.filter(n => ts.isFunctionDeclaration(n) && n.name?.text === "CategoryDrawer") : [ast];
    function visit(n: ts.Node) {
      if (ts.isJsxText(n)) assert.equal(n.text.trim(), "", n.text.trim());
      if (ts.isJsxAttribute(n) && ["title", "description", "placeholder", "aria-label", "alt", "label"].includes(n.name.getText(ast)) && n.initializer) assert.ok(!ts.isStringLiteral(n.initializer), n.getText(ast));
      if (ts.isCallExpression(n) && /^(toast\.(success|error)|useDocumentTitle)$/.test(n.expression.getText(ast))) assert.ok(!n.arguments.some(ts.isStringLiteral), n.getText(ast));
      ts.forEachChild(n, visit);
    }
    nodes.forEach(visit);
  }
  for (const namespace of [fa.InventoryCategories, fa.InventoryNavigation]) for (const value of Object.values(namespace)) assert.match(value, /[\u0600-\u06ff]/);
});
