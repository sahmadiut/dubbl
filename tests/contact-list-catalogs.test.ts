import { resolvePresentation } from "../i18n/locale";
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
import { renderWithPresentation } from "./helpers/presentation";
import * as money from "../lib/money/contact-dashboard-ui";
import * as DataTable from "../components/dashboard/data-table";
import * as DatePicker from "../components/ui/date-picker";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";

const list = "app/(dashboard)/contacts/page.tsx";
const picker = "components/dashboard/contact-picker.tsx";
const drawer = "components/dashboard/create-drawer.tsx";
const locales = ["en-US", "fa-IR"] as const;
const noop = () => {};
const caller = '<script>مخاطب & contact</script>';
const raw = { id: "contact-a", name: caller, email: "contact@example.test", phone: "+98-123", taxNumber: "T-123", type: "both", paymentTermsDays: 30,
  creditLimit: 9007199254740991, creditLimitMinor: "9007199254740991", currencyCode: "USD", isTaxExempt: true, is1099Vendor: true,
  createdAt: "2026-10-19T00:00:00Z", owesYou: 1250, owesYouMinor: "1250", youOwe: 2000, youOweMinor: "2000", overdue: 3250, overdueMinor: "3250" };
const saved = money.contactListUi(raw);
function translator(locale: typeof locales[number]) { return createTranslator({ locale, messages: locale === "en-US" ? en : fa, namespace: "Contacts" }); }
function escape(value: string) { return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#x27;"); }
function parse(path: string) { return ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX); }
type Captured = { kind: string; props: Record<string, unknown> };

// Production JSX, table, controls and next-intl; controlled hooks/navigation and
// inline portal boundaries expose options for assertions without a browser.
function loaded(path: string, states: Record<string, unknown> = {}, captured: Captured[] = [], events: unknown[] = []) {
  const ast = parse(path), name = path === list ? "ContactsPage" : path === picker ? "ContactPicker" : "ContactDrawer";
  const component = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === name)!;
  const names: string[] = [];
  function hooks(n: ts.Node) {
    if (ts.isVariableDeclaration(n) && ts.isArrayBindingPattern(n.name) && n.initializer && ts.isCallExpression(n.initializer) && n.initializer.expression.getText(ast) === "useState") names.push(n.name.elements[0].getText(ast));
    ts.forEachChild(n, hooks);
  }
  hooks(component);
  let source = ast.text;
  if (path === drawer) {
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
    }).join("\n") + `\nexport { ${name} };`;
  }
  const inline = (kind: string) => function InlineControl(props: Record<string, unknown>) {
    captured.push({ kind, props });
    return createElement("div", { "data-control": kind, "data-value": props.value ?? props.defaultValue, title: props.title as string | undefined }, props.children as ReactNode,
      typeof props.placeholder === "string" ? createElement("span", null, props.placeholder) : null);
  };
  let index = 0;
  const require = createRequire(resolve(path)), compiled = { exports: {} as Record<string, ComponentType<Record<string, unknown>>> };
  const load = (id: string) => {
    if (id === "react") return { ...React, useState: (initial: unknown) => { const key = names[index++]; return [Object.hasOwn(states, key) ? states[key] : initial, (value: unknown) => events.push([key, value])]; }, useEffect: noop, useRef: (value: unknown) => ({ current: value }), useCallback: (fn: unknown) => fn };
    if (id === "next-intl") return nextIntl;
    if (id.endsWith("/data-table")) return DataTable;
    if (id.endsWith("/ui/date-picker")) return DatePicker;
    if (id === "next/navigation") return { useRouter: () => ({ push: (url: string) => events.push(url) }) };
    if (id.endsWith("/create-drawer")) return { useCreateDrawer: () => ({ open: (...args: unknown[]) => events.push(args) }) };
    if (id.endsWith("/use-confirm")) return { useConfirm: () => ({ confirm: noop, dialog: null }) };
    if (id.endsWith("/use-debounce")) return { useDebounce: (value: string) => states.debouncedSearch ?? value };
    if (id.endsWith("/use-document-title")) return { useDocumentTitle: (value: string) => events.push(value) };
    for (const [suffix, names] of Object.entries({ "/ui/sheet": ["Sheet", "SheetContent", "SheetHeader", "SheetTitle", "SheetDescription"],
      "/ui/select": ["Select", "SelectTrigger", "SelectContent", "SelectValue", "SelectItem"],
      "/ui/popover": ["Popover", "PopoverTrigger", "PopoverContent"],
      "/ui/command": ["Command", "CommandInput", "CommandList", "CommandEmpty", "CommandGroup", "CommandItem", "CommandSeparator"],
      "/ui/dropdown-menu": ["DropdownMenu", "DropdownMenuTrigger", "DropdownMenuContent", "DropdownMenuItem"] })) {
      if (id.endsWith(suffix)) return Object.fromEntries(names.map(key => [key, inline(key)]));
    }
    return require(id.startsWith("@/") ? resolve(id.slice(2)) : id);
  };
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  new Function("require", "module", "exports", code)(load, compiled, compiled.exports);
  return compiled.exports[path === list ? "default" : name];
}

// Actual callback bodies, with controlled IO and real exact-money adapters.
function callback(path: string, name: string, scope: Record<string, unknown>) {
  const ast = parse(path); let expression = "";
  function visit(n: ts.Node) {
    if (path === drawer && ts.isFunctionDeclaration(n) && n.parent === ast && n.name?.text !== "ContactDrawer") return;
    if (ts.isFunctionDeclaration(n) && n.name?.text === name) expression = n.getText(ast);
    if (ts.isVariableDeclaration(n) && n.name.getText(ast) === name && n.initializer && ts.isCallExpression(n.initializer)) expression = n.initializer.arguments[0].getText(ast);
    if (name === "effect" && ts.isCallExpression(n) && n.expression.getText(ast) === "useEffect" && !expression) expression = n.arguments[0].getText(ast);
    ts.forEachChild(n, visit);
  }
  visit(ast); assert.ok(expression, name);
  const code = ts.transpileModule(`const run = ${expression};`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  return new Function(...Object.keys(scope), `${code}; return run;`)(...Object.values(scope));
}
const flush = async () => { for (let i = 0; i < 8; i++) await new Promise(resolve => setImmediate(resolve)); };

test("contact list renders translated empty, populated, filter, busy and exact-money states", () => {
  for (const locale of locales) {
    const t = translator(locale), events: unknown[] = [];
    const Empty = loaded(list, { loading: false }, [], events);
    const empty = renderWithPresentation(createElement(Empty), locale);
    for (const key of ["emptyTitle", "emptyDescription", "firstContact", "customers", "customersHint", "suppliers", "suppliersHint", "linkedData", "linkedHint"] as const) assert.ok(empty.includes(escape(t(key))), key);
    assert.ok(events.includes(t("documentTitle")));
    const captured: Captured[] = [];
    const Page = loaded(list, { loading: false, contacts: [saved], dateFrom: "2026-01-01", hasMore: false }, captured);
    const html = renderWithPresentation(createElement(Page), locale);
    for (const key of ["title", "description", "duplicates", "duplicatesHint", "all", "name", "type", "phone", "paymentTerms", "creditLimit", "owesYou", "youOwe", "overdue", "tax", "currency", "created", "both", "taxHint", "vendorHint", "noTax", "actions", "search", "from", "to", "endDate", "sortBy", "newest", "oldest", "nameAsc", "nameDesc", "shortest", "longest", "clearDates", "open", "opportunity", "opportunityHint", "delete"] as const) assert.ok(html.includes(escape(t(key))), key);
    for (const key of ["contactCount", "customerCount", "supplierCount", "noTaxCount"] as const) assert.ok(html.includes(escape(t(key, { count: 1 }))));
    for (const amount of [saved.creditLimit!, saved.owesYou, saved.youOwe, saved.overdue]) assert.ok(html.includes(escape(money.displayMoney(amount, "USD", resolvePresentation({ user: { language: locale } })))));
    assert.ok(html.includes(escape(caller)) && !html.includes("<script>"));
    assert.ok(html.includes("contact@example.test") && html.includes("+98-123") && html.includes("1099"));
    assert.deepEqual(captured.filter(c => c.kind === "SelectItem").map(c => c.props.value), ["created:desc", "created:asc", "name:asc", "name:desc", "terms:asc", "terms:desc"]);
    const Zero = loaded(list, { loading: false, contacts: [{ ...saved, type: "customer", paymentTermsDays: 0, creditLimit: null, owesYou: 0n, youOwe: 0n, overdue: 0n }] });
    const zero = renderWithPresentation(createElement(Zero), locale);
    assert.ok(zero.includes(escape(t("dueOnReceipt"))) && zero.includes(escape(t("noLimit"))));
    const Busy = loaded(list, { loading: false, contacts: [saved], refetching: true });
    assert.ok(renderWithPresentation(createElement(Busy), locale).includes(`aria-label="${escape(t("loading"))}"`));
    const Filtered = loaded(list, { loading: false, search: "missing" });
    assert.ok(renderWithPresentation(createElement(Filtered), locale).includes(escape(t("empty"))));
  }
});

test("contact picker renders selected, search, empty and creation copy and preserves selection callbacks", () => {
  for (const locale of locales) for (const type of ["customer", "supplier", "both", "constructor"]) {
    const t = translator(locale), captured: Captured[] = [], events: unknown[] = [];
    const Picker = loaded(picker, { open: true, loading: false, contacts: [{ ...raw, type }] }, captured, events);
    const html = renderWithPresentation(createElement(Picker, { value: "contact-a", onChange: (id: string) => events.push(id) }), locale);
    for (const key of ["search", "pickerEmpty", "createNew"] as const) assert.ok(html.includes(escape(t(key))), key);
    assert.ok(html.includes(escape(caller)) && !html.includes("<script>"));
    if (type !== "constructor") assert.ok(html.includes(escape(t(type === "both" ? "bothShort" : type as "customer" | "supplier"))));
    const item = captured.find(c => c.kind === "CommandItem")!;
    assert.equal(item.props.value, `${caller} contact@example.test`);
    (item.props.onSelect as () => void)();
    assert.deepEqual(events, ["", ["open", false]]);
    for (const placeholder of [undefined, "", caller]) {
      const Empty = loaded(picker, { loading: false });
      assert.ok(renderWithPresentation(createElement(Empty, { value: "", onChange: noop, placeholder }), locale).includes(escape(placeholder ?? t("selectContact"))));
    }
  }
});

test("contact drawer translates fields, canonical type options, defaults and busy footer", () => {
  for (const locale of locales) for (const saving of [false, true]) {
    const t = translator(locale), captured: Captured[] = [];
    const Drawer = loaded(drawer, { saving }, captured);
    const html = renderWithPresentation(createElement(Drawer, { open: true, onClose: noop }), locale);
    for (const key of ["newContact", "newDescription", "basicInfo", "nameRequired", "contactName", "email", "phone", "details", "type", "customer", "supplier", "bothShort", "termsDays", "taxNumber", "taxPlaceholder", "notes", "notesPlaceholder", "cancel", saving ? "creating" : "create"] as const) assert.ok(html.includes(escape(t(key))), key);
    assert.match(html, /<input[^>]*name="name"[^>]*>/);
    assert.ok(html.includes('required=""') && html.includes('type="email"'));
    assert.ok(html.includes('name="paymentTermsDays"') && html.includes('min="0"') && html.includes('value="30"'));
    assert.deepEqual(captured.filter(c => c.kind === "SelectItem").map(c => c.props.value), ["customer", "supplier", "both"]);
    assert.equal(captured.find(c => c.kind === "Select")!.props.defaultValue, "customer");
    if (saving) assert.ok(html.includes('disabled=""'));
  }
});

test("contact creation preserves request defaults, optional nulls, navigation and localized retry failures", async () => {
  for (const locale of locales) for (const mode of ["success", "optional", "zero-terms", "status", "html", "shape", "network", "no-org"]) {
    const t = translator(locale), events: unknown[] = [];
    const form = new Map(Object.entries(mode === "optional" ? { name: caller } : { name: caller, email: "c@example.test", phone: "+98-123", taxNumber: "T-123", type: "both", paymentTermsDays: mode === "zero-terms" ? "0" : "45", notes: caller }));
    await callback(drawer, "handleSubmit", { unitPresentation: resolvePresentation({ user: { language: locale } }), t, FormData: class { get(key: string) { return form.get(key) ?? null; } },
      localStorage: { getItem: () => mode === "no-org" ? null : "org-a" }, setSaving: (v: boolean) => events.push(v), onClose: () => events.push("close"), router: { push: (v: string) => events.push(v) },
      toast: { success: (v: string) => events.push(v), error: (v: string) => events.push(v) },
      fetch: async (url: string, init: RequestInit) => {
        assert.equal(url, "/api/v1/contacts"); assert.equal(init.method, "POST");
        assert.deepEqual(init.headers, { "Content-Type": "application/json", "x-organization-id": "org-a" });
        assert.deepEqual(JSON.parse(init.body as string), { name: caller, email: form.get("email") || null, phone: form.get("phone") || null, taxNumber: form.get("taxNumber") || null, type: form.get("type") || "customer", paymentTermsDays: ["optional", "zero-terms"].includes(mode) ? 30 : 45, notes: form.get("notes") || null });
        if (mode === "network") throw new Error("private server prose");
        if (mode === "html") return new Response("<html>private server prose</html>");
        return Response.json(mode === "shape" ? { contact: { id: 42 } } : { contact: { id: "new-a" }, error: "private server prose" }, { status: mode === "status" ? 403 : 201 });
      } })({ preventDefault: noop, currentTarget: {} });
    assert.deepEqual(events, mode === "no-org" ? [] : ["success", "optional", "zero-terms"].includes(mode) ? [true, t("createdSuccess"), "close", "/contacts/new-a", false] : [true, t("createFailed"), false]);
  }
});

test("delete confirmation preserves cancellation, scoped DELETE, rows on failure and retry dialog", async () => {
  for (const locale of locales) for (const mode of ["success", "cancel", "status", "network", "no-org"]) {
    const t = translator(locale), events: unknown[] = [];
    let rows = [saved], total = 4;
    const run = callback(list, "handleDelete", { unitPresentation: resolvePresentation({ user: { language: locale } }), t, localStorage: { getItem: () => mode === "no-org" ? null : "org-a" },
      confirm: async (options: { title: string; description: string; confirmLabel: string; cancelLabel: string; destructive: boolean; onConfirm: () => Promise<void> }) => {
        assert.equal(options.title, t("deleteTitle", { name: caller })); assert.equal(options.description, t("deleteDescription"));
        assert.equal(options.confirmLabel, t("delete")); assert.equal(options.cancelLabel, t("cancel")); assert.equal(options.destructive, true);
        if (mode !== "cancel") await options.onConfirm();
      },
      setContacts: (fn: (v: typeof rows) => typeof rows) => { rows = fn(rows); }, setTotal: (fn: (v: number) => number) => { total = fn(total); },
      toast: { success: (v: string) => events.push(v), error: (v: string) => events.push(v) },
      fetch: async (url: string, init: RequestInit) => { events.push("delete"); assert.equal(url, "/api/v1/contacts/contact-a"); assert.deepEqual(init, { method: "DELETE", headers: { "x-organization-id": "org-a" } });
        if (mode === "network") throw new Error("private server prose");
        return new Response(null, { status: mode === "status" ? 403 : 204 }); },
    });
    if (["network", "status"].includes(mode)) await assert.rejects(run(saved), { message: t("deleteFailed") }); else await run(saved);
    assert.deepEqual(rows, mode === "success" ? [] : [saved]); assert.equal(total, mode === "success" ? 3 : 4);
    assert.deepEqual(events, ["cancel", "no-org"].includes(mode) ? [] : ["delete", t(mode === "success" ? "deleted" : "deleteFailed")]);
  }
});

test("list and pagination callbacks preserve filter codes, exact alias validation and localized failures", async () => {
  for (const locale of locales) for (const next of [false, true]) for (const mode of ["success", "status", "html", "shape", "alias", "network", "no-org", "cancel"]) {
    const t = translator(locale), events: unknown[] = [];
    let rows: unknown[] = next ? [saved] : [], page = 1;
    const scope = { unitPresentation: resolvePresentation({ user: { language: locale } }), t, loading: true, loadingMore: false, hasMore: true, page, debouncedSearch: caller, typeFilter: "both", sortBy: "name", sortOrder: "asc", dateFrom: "2026-01-01", dateTo: "2026-10-19",
      localStorage: { getItem: () => mode === "no-org" ? null : "org-a" }, displayJson: money.displayJson, contactListUi: money.contactListUi, devDelay: async () => {},
      setContacts: (value: unknown[] | ((v: unknown[]) => unknown[])) => { rows = typeof value === "function" ? value(rows) : value; },
      setPage: (v: number) => { page = v; }, setHasMore: noop, setRefetching: noop, setLoading: noop, setLoadingMore: noop, setFetchKey: noop, setTotal: noop,
      toast: { error: (v: string) => events.push(v) },
      fetch: async (url: string, init: RequestInit) => {
        const parsed = new URL(url, "https://example.test"); assert.equal(parsed.pathname, "/api/v1/contacts");
        assert.deepEqual(Object.fromEntries(parsed.searchParams), { search: caller, type: "both", sortBy: "name", sortOrder: "asc", from: "2026-01-01", to: "2026-10-19", page: next ? "2" : "1", limit: "50" });
        assert.deepEqual(init.headers, { "x-organization-id": "org-a" });
        if (mode === "network") throw new Error("private server prose");
        if (mode === "html") return new Response("private server prose");
        return Response.json({ data: mode === "shape" ? {} : [{ ...raw, owesYouMinor: mode === "alias" ? "1251" : "1250" }], pagination: { page: next ? 2 : 1, total: 100, totalPages: 2 } }, { status: mode === "status" ? 403 : 200 });
      } };
    const cleanup = callback(list, next ? "loadMore" : "effect", scope)();
    if (!next && mode === "cancel" && cleanup) cleanup();
    await flush();
    if (mode === "no-org" || (!next && mode === "cancel")) { assert.deepEqual(events, []); continue; }
    assert.deepEqual(events, ["success", "cancel"].includes(mode) ? [] : [t("readFailed")]);
    assert.equal(rows.length, ["success", "cancel"].includes(mode) ? next ? 2 : 1 : 0);
    if (rows.length) assert.equal((rows.at(-1) as typeof saved).creditLimit, 9007199254740991n);
    assert.equal(page, next && ["success", "cancel"].includes(mode) ? 2 : 1);
  }
});

test("picker read effect preserves filter/limit/cache and handles HTTP, envelope, JSON and network errors", async () => {
  for (const locale of locales) for (const mode of ["success", "status", "html", "shape", "network", "no-org", "closed", "cached"]) {
    const t = translator(locale), events: unknown[] = [], fetchedRef = { current: mode === "cached" };
    callback(picker, "effect", { unitPresentation: resolvePresentation({ user: { language: locale } }), t, open: mode !== "closed", type: "supplier", fetchedRef, localStorage: { getItem: () => mode === "no-org" ? null : "org-a" },
      setContacts: (v: unknown) => events.push(v), setLoading: (v: boolean) => events.push(v), toast: { error: (v: string) => events.push(v) },
      fetch: async (url: string, init: RequestInit) => {
        assert.equal(url, "/api/v1/contacts?limit=200&type=supplier"); assert.deepEqual(init.headers, { "x-organization-id": "org-a" });
        if (mode === "network") throw new Error("private server prose"); if (mode === "html") return new Response("private server prose");
        return Response.json({ data: mode === "shape" ? {} : [raw] }, { status: mode === "status" ? 403 : 200 });
      } })();
    await flush();
    assert.deepEqual(events, ["closed", "cached", "no-org"].includes(mode) ? [] : mode === "success" ? [[raw], false] : [t("pickerReadFailed"), false]);
    assert.equal(fetchedRef.current, ["success", "cached"].includes(mode));
  }
});

test("owned source copy audit permits only explicit technical exceptions and validates Persian script and plurals", () => {
  for (const path of [list, picker, drawer]) {
    const ast = parse(path);
    function visit(node: ts.Node) {
      if (path === drawer && ts.isFunctionDeclaration(node) && node.parent === ast && node.name?.text !== "ContactDrawer") return;
      if (ts.isJsxText(node)) assert.ok(["", "1099", "·", "-"].includes(node.text.trim()), `${path}: ${node.text.trim()}`);
      if (ts.isJsxAttribute(node) && ["title", "description", "placeholder", "aria-label", "emptyMessage", "label"].includes(node.name.getText(ast)) && node.initializer && ts.isStringLiteral(node.initializer)) assert.ok(["email@example.com", "+1 (555) 000-0000"].includes(node.initializer.text), node.getText(ast));
      ts.forEachChild(node, visit);
    }
    visit(ast);
  }
  for (const value of Object.values(fa.Contacts)) assert.match(value, /[\u0600-\u06ff]/);
  for (const locale of locales) for (const count of [0, 1, 2]) for (const key of ["contactCount", "customerCount", "supplierCount", "noTaxCount"] as const) {
    const message = translator(locale)(key, { count }); assert.ok(message.includes(new Intl.NumberFormat(locale).format(count)));
    assert.ok(!message.includes("{count"));
  }
});
