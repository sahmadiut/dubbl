import { formatDecimalDraft } from "../i18n/numbers";
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
import * as presentation from "../i18n/inventory-item-presentation";
import { inventoryUiItem, inventoryUiListSummary } from "../lib/money/inventory-ui";
import { inventoryDetailMoney, inventoryWriteDown } from "../lib/money/inventory-detail-ui";
import { catalogPriceMinor, catalogWholeInput } from "../lib/money/catalog-input";
import { toMajorDecimal, money } from "../lib/money/exact";
import { bankMoneyDisplay } from "../lib/money/bank-display";
import * as BrandLoader from "../components/dashboard/brand-loader";
import { renderWithPresentation } from "./helpers/presentation";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";

const page = "app/(dashboard)/inventory/page.tsx";
const details = "app/(dashboard)/inventory/[id]/page.tsx";
const layout = "app/(dashboard)/inventory/[id]/layout.tsx";
const history = "app/(dashboard)/inventory/[id]/history/page.tsx";
const drawer = "components/dashboard/create-drawer.tsx";
const picker = "components/dashboard/inventory-item-picker.tsx";
const locales = ["en-US", "fa-IR"] as const;
const noop = () => {};
const caller = '<script>کالا & "name"</script>';
const item = { id: "item-a", code: "ITEM-001", name: caller, description: caller, category: caller,
  categoryId: "category-a", sku: "SKU-001", imageUrl: null, purchasePrice: 3000000001, purchasePriceMinor: "3000000001",
  salePrice: 3000000002, salePriceMinor: "3000000002", totalValue: 6000000002, totalValueMinor: "6000000002",
  priceValue: 9000000003, priceValueMinor: "9000000003", averageCost: 2000000001, averageCostMinor: "2000000001",
  standardCost: 3000000001, standardCostMinor: "3000000001", quantityOnHand: 3, reorderPoint: 5, isActive: true };
const summary = { totalItems: 1, totalValue: 6000000002, totalValueMinor: "6000000002", lowStockCount: 1, avgMargin: 0.05, avgMarginExact: "0.0500" };
const list = { data: [item], categories: [caller], pagination: { page: 1, total: 1, totalPages: 1 }, summary };
const movement = { id: "movement-a", type: "purchase", quantity: 3, previousQuantity: 0, newQuantity: 3,
  reason: caller, createdBy: caller, createdAt: "2026-10-20T00:00:00Z", unitCost: 3000000001, unitCostMinor: "3000000001", value: 9000000003, valueMinor: "9000000003" };
const stock = { id: "stock-a", warehouseId: "warehouse-a", warehouseName: caller, warehouseCode: "WH-001", quantity: 3, updatedAt: "2026-10-20T00:00:00Z" };
const formatMoney = (value: number | bigint) => bankMoneyDisplay(value, "USD");
const escape = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#x27;");
const translator = (locale: typeof locales[number]) => createTranslator({ locale, messages: locale === "en-US" ? en : fa, namespace: "InventoryItems" });
const parse = (file: string) => ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
type Captured = { kind: string; props: Record<string, unknown> };
type Effect = () => void | (() => void);
const componentName = (file: string) => file === page ? "InventoryPage" : file === details ? "InventoryItemDetailsPage" : file === layout ? "InventoryItemWorkspace" : file === history ? "InventoryItemHistoryPage" : file === drawer ? "InventoryDrawer" : "InventoryItemPicker";

// Actual templates, controls and next-intl; only hook/portal/chart/IO boundaries
// are controlled. This exercises production callbacks, not a browser mount.
function loaded(file: string, states: Record<string, unknown> = {}, captured: Captured[] = [], events: unknown[] = [], effects: Effect[] = [], io: Record<string, unknown> = {}) {
  const ast = parse(file), name = componentName(file);
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
    return createElement(kind === "AreaChart" ? "svg" : "div", { "data-control": kind, "data-value": props.value as string }, props.children as ReactNode,
      typeof props.placeholder === "string" ? createElement("span", null, props.placeholder) : null);
  };
  let index = 0;
  const require = createRequire(resolve(file)), compiled = { exports: {} as Record<string, ComponentType<Record<string, unknown>>> };
  const load = (id: string): unknown => {
    if (id === "react") return { ...React,
      useState: (initial: unknown) => { const key = names[index++]; return [Object.hasOwn(states, key) ? states[key] : initial, (v: unknown) => events.push([key, v])]; },
      useEffect: (effect: Effect) => effects.push(effect), useRef: (v: unknown) => ({ current: v }), useCallback: (fn: unknown) => fn };
    if (id === "next-intl") return nextIntl;
    if (id === "next/navigation") return { useParams: () => ({ id: item.id }), usePathname: () => states.pathname ?? `/inventory/${item.id}`, useRouter: () => ({ push: (path: string) => events.push(path) }) };
    if (id === "sonner") return { toast: { success: (v: string) => events.push(v), error: (v: string) => events.push(v) } };
    if (id === "./layout") return { useInventoryItem: () => ({ item, setItem: (fn: (v: unknown) => unknown) => events.push(fn(item)) }) };
    if (id.endsWith("/create-drawer")) return { useCreateDrawer: () => ({ open: (kind: string) => events.push(kind) }) };
    if (id.endsWith("/category-picker")) return { CategoryPicker: inline("CategoryPicker") };
    if (id.endsWith("/use-confirm")) return { useConfirm: () => ({ confirm: noop, dialog: null }) };
    if (id.endsWith("/use-debounce")) return { useDebounce: (v: string) => states.debouncedSearch ?? v };
    if (id.endsWith("/use-document-title")) return { useDocumentTitle: (v: string) => events.push(v) };
    if (id.endsWith("/use-entity-title")) return { setEntityTitle: (v: string) => events.push(v) };
    if (id.endsWith("/brand-loader")) return BrandLoader;
    if (id === "recharts") return Object.fromEntries(["AreaChart", "Area", "XAxis", "YAxis", "CartesianGrid", "Tooltip", "ResponsiveContainer", "Legend"].map(key => [key, inline(key)]));
    for (const [suffix, names] of Object.entries({ "/ui/sheet": ["Sheet", "SheetContent", "SheetHeader", "SheetTitle", "SheetDescription", "SheetFooter"], "/ui/popover": ["Popover", "PopoverContent", "PopoverTrigger"], "/ui/command": ["Command", "CommandEmpty", "CommandGroup", "CommandInput", "CommandItem", "CommandList"], "/ui/select": ["Select", "SelectContent", "SelectItem", "SelectTrigger", "SelectValue"] })) {
      if (id.endsWith(suffix)) return Object.fromEntries(names.map(key => [key, inline(key)]));
    }
    return require(id.startsWith("@/") ? resolve(id.slice(2)) : id);
  };
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const scope = { localStorage: { getItem: () => "org-a" }, window: {}, ...io };
  new Function("require", "module", "exports", ...Object.keys(scope), code)(load, compiled, compiled.exports, ...Object.values(scope));
  return compiled.exports[name];
}
function callback(file: string, name: string, scope: Record<string, unknown> = {}) {
  const ast = parse(file); let expression = "";
  function visit(n: ts.Node) {
    if (ts.isFunctionDeclaration(n) && n.name?.text === name) expression = n.getText(ast);
    if (ts.isVariableDeclaration(n) && n.name.getText(ast) === name && n.initializer && ts.isCallExpression(n.initializer)) expression = n.initializer.arguments[0].getText(ast);
    ts.forEachChild(n, visit);
  }
  const owner = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === componentName(file))!;
  visit(owner); assert.ok(expression, name);
  const code = ts.transpileModule(`const run = ${expression};`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  return new Function(...Object.keys(scope), `${code}; return run;`)(...Object.values(scope));
}
const event = { preventDefault: noop, currentTarget: {} };
const flush = async () => { for (let i = 0; i < 6; i++) await new Promise(resolve => setImmediate(resolve)); };
function response(mode: string, good: unknown) {
  if (mode === "network") throw new Error("private server prose");
  if (mode === "json") return new Response("private server prose");
  return Response.json(mode === "shape" ? {} : good, { status: mode === "status" ? 403 : 200 });
}

test("inventory list renders paired filters, sort labels, sheets, chart legends, counts, caller data and exact prices", () => {
  for (const locale of locales) for (const selectMode of [false, true]) {
    const t = translator(locale), captured: Captured[] = [], events: unknown[] = [];
    const Page = loaded(page, { loading: false, items: [item], summary, hasMore: false, selectMode,
      selected: new Set([item.id]), chartData: [{ date: "2026-10-20", in: 3, out: 0, net: 3 }],
      importResult: { created: 1, updated: 2, errors: [{ row: 4, message: "private server prose" }] } }, captured, events);
    const html = renderWithPresentation(createElement(Page), locale);
    for (const key of ["totalItems", "valueOfStock", "avgMargin", "stockMovements", "searchAll", "setCategory", "changeCount", "importResults", "rowError", "cancel"] as const) assert.ok(html.includes(escape(t(key))), key);
    for (const [key, count] of [["showingAll", 1], ["bulkCategoryHelp", 1], ["bulkAdjustDescription", 1]] as const) assert.ok(html.includes(escape(t(key, { count }))));
    assert.ok(html.includes(escape(caller)) && !html.includes("<script>") && !html.includes("private server prose"));
    assert.ok(html.includes(bankMoneyDisplay(3000000001n, "USD", resolvePresentation({ user: { language: locale } }))) && html.includes(bankMoneyDisplay(3000000002n, "USD", resolvePresentation({ user: { language: locale } }))) && html.includes(bankMoneyDisplay(9000000003n, "USD", resolvePresentation({ user: { language: locale } }))));
    assert.ok(events.includes(t("documentTitle")));
    assert.deepEqual(captured.filter(c => c.kind === "SelectItem").map(c => c.props.value), ["createdAt", "name", "code", "quantity", "salePrice", "purchasePrice"]);
    assert.deepEqual(captured.filter(c => c.kind === "Area").map(c => [c.props.dataKey, c.props.name]), [["in", t("in")], ["out", t("out")]]);
    if (selectMode) assert.ok(html.includes(escape(t("selected", { count: 1 }))));
  }
});

test("inventory empty, loading, search, pending and ICU singular/plural branches preserve authored behavior", () => {
  for (const locale of locales) {
    const t = translator(locale);
    for (const [states, key] of [[{ loading: false }, "emptyTitle"], [{ loading: false, search: caller, debouncedSearch: caller }, "noSearchItems"], [{ loading: false, tab: "active" }, "noItems"]] as const) {
      const Page = loaded(page, states), html = renderWithPresentation(createElement(Page), locale);
      assert.ok(html.includes(escape(t(key, { search: caller }))));
    }
    const Pending = loaded(page, { loading: false, items: [item], refetching: true });
    assert.ok(renderWithPresentation(createElement(Pending), locale).includes(`aria-label="${escape(t("loading"))}"`));
    const Loading = loaded(page);
    assert.ok(!renderWithPresentation(createElement(Loading), locale).includes(escape(t("emptyTitle"))));
    for (const count of [0, 1, 2]) for (const key of ["showingAll", "bulkUpdated", "bulkDeleteTitle", "bulkCategoryHelp", "bulkAdjustDescription"] as const) assert.ok(!/MISSING|INVALID/.test(t(key, { count })));
    if (locale === "en-US") assert.equal(t("bulkUpdated", { count: 1 }), "1 item updated");
  }
});

test("item details and creation render real fields, required labels, shared footer, busy state and exact major values", () => {
  for (const locale of locales) for (const saving of [false, true]) for (const file of [details, drawer]) {
    const t = translator(locale), Page = loaded(file, { saving, warehouseStocks: [stock] });
    const html = renderWithPresentation(createElement(Page, { open: true, onClose: noop }), locale);
    const keys = file === details ? ["general", "saveChanges", "stockByLocation", "barcode", "revalueStock", "deleteItem", "reasonRequired"] as const : ["newInventoryItem", "createDescription", "itemInfo", "nameRequired", "codeRequired", "createItem", "cancel"] as const;
    for (const key of keys) if (!(saving && ["saveChanges", "createItem"].includes(key))) assert.ok(html.includes(escape(t(key))), key);
    if (saving) assert.ok(html.includes(escape(t(file === details ? "saving" : "creating"))));
    assert.equal(/<button(?=[^>]*type="submit")(?=[^>]*disabled="")/.test(html), saving);
    for (const field of ["code", "name", "description", "sku", "reorderPoint"]) assert.ok(html.includes(`name="${field}"`));
    if (file === details) assert.ok(html.includes(`value="${formatDecimalDraft("30000000.01", resolvePresentation({ user: { language: locale } }))}"`) && html.includes(escape(caller)));
    else assert.ok(html.includes('name="quantityOnHand"') && html.includes('name="purchasePrice"'));
  }
});

test("item workspace renders exact book versus catalog values, navigation, statuses and write-down preview/errors", () => {
  for (const locale of locales) for (const isActive of [true, false]) for (const writeDownAmount of ["0.01", "999999999.99", "0.001"]) {
    const t = translator(locale), events: unknown[] = [], Page = loaded(layout, { loading: false, item: { ...item, isActive }, writeDownAmount }, [], events);
    const html = renderWithPresentation(createElement(Page, { id: item.id, orgId: "org-a" }, "child"), locale);
    for (const key of ["details", "history", "suppliers", "variants", "unitsOnHand", "valueOfStock", "writeDown", "changeCount", isActive ? "shown" : "hidden"] as const) assert.ok(html.includes(escape(t(key))), key);
    assert.ok(html.includes(bankMoneyDisplay(6000000002n, "USD", resolvePresentation({ user: { language: locale } }))) && html.includes(bankMoneyDisplay(9000000003n, "USD", resolvePresentation({ user: { language: locale } }))) && html.includes(escape(caller)) && !html.includes("<script>"));
    if (writeDownAmount === "0.01") assert.ok(html.includes(escape(t("writeDownPreview", { amount: bankMoneyDisplay(1n, "USD", resolvePresentation({ user: { language: locale } })), remaining: bankMoneyDisplay(6000000001n, "USD", resolvePresentation({ user: { language: locale } })) }))));
    else assert.ok(html.includes(escape(t(writeDownAmount === "0.001" ? "writeDownInvalid" : "writeDownExceeds"))) && html.includes('role="alert"'));
  }
  for (const locale of locales) for (const states of [{ loading: false, readError: translator(locale)("readFailed") }, { loading: false }, { loading: false, item: { ...item, totalValueMinor: "1" } }]) {
    const Page = loaded(layout, states), html = renderWithPresentation(createElement(Page, { id: item.id, orgId: "org-a" }), locale);
    assert.ok(html.includes(escape(translator(locale)("notFound"))) || html.includes('role="alert"'));
    assert.ok(!html.includes("aliases disagree"));
  }
});

test("history localizes finite movement labels while unknown codes, reasons and creators remain escaped caller data", () => {
  for (const locale of locales) for (const type of ["purchase", "stock-take", "adjustment", "transfer_in", "revaluation", "write_down", "constructor", caller]) {
    const t = translator(locale), Page = loaded(history, { loading: false, movements: [{ ...movement, type }] });
    const html = renderWithPresentation(createElement(Page), locale), key = presentation.inventoryMovementKey(type.replaceAll("-", "_"));
    assert.ok(html.includes(escape(key ? t(key) : type)) && html.includes(escape(t("by", { name: caller }))));
    assert.ok(html.includes(escape(caller)) && !html.includes("<script>"));
  }
  for (const locale of locales) {
    const Page = loaded(history, { loading: false });
    assert.ok(renderWithPresentation(createElement(Page), locale).includes(escape(translator(locale)("emptyHistory"))));
  }
});

test("item picker retains organization isolation, selected resolution, caller placeholder and canonical toggle selection", () => {
  for (const locale of locales) for (const selected of [false, true]) {
    const t = translator(locale), captured: Captured[] = [], events: unknown[] = [];
    const Picker = loaded(picker, { itemsOrg: "org-a", items: [item] }, captured, events);
    const html = renderWithPresentation(createElement(Picker, { value: selected ? item.id : "", onChange: (v: string) => events.push(v) }), locale);
    assert.ok(html.includes(escape(t("searchItems"))) && html.includes(escape(t("itemQuantity", { count: 3 }))) && html.includes(escape(caller)));
    assert.deepEqual(captured.filter(c => c.kind === "CommandItem").map(c => c.props.value), [item.id]);
    (captured.find(c => c.kind === "CommandItem")!.props.onSelect as () => void)();
    assert.deepEqual(events.slice(-3), [selected ? "" : item.id, ["open", false], ["search", ""]]);
    const Stale = loaded(picker, { itemsOrg: "org-b", items: [item], selectedOrg: "org-b", selected: item });
    const staleHtml = renderWithPresentation(createElement(Stale, { value: item.id, onChange: noop }), locale);
    assert.ok(staleHtml.includes(escape(t("selectItem"))) && !staleHtml.includes(escape(caller)));
    const Custom = loaded(picker);
    assert.ok(renderWithPresentation(createElement(Custom, { value: "", onChange: noop, placeholder: caller }), locale).includes(escape(caller)));
    for (const search of ["", "none"]) {
      const Empty = loaded(picker, { search });
      assert.ok(renderWithPresentation(createElement(Empty, { value: "", onChange: noop }), locale).includes(escape(t(search ? "noMatches" : "noItems"))));
    }
  }
});

test("response boundaries validate whole envelopes before adoption and retain exact aliases and raw contracts", async () => {
  assert.deepEqual(await presentation.inventoryItemJson(Response.json({ inventoryItem: item })), item);
  assert.deepEqual(await presentation.inventoryItemsJson(Response.json({ data: [item] })), [item]);
  assert.deepEqual(await presentation.inventoryListJson(Response.json(list)), list);
  assert.deepEqual(await presentation.inventoryImportJson(Response.json({ created: 1, updated: 0, errors: [{ row: 2, message: caller }] })), { created: 1, updated: 0, errors: [{ row: 2, message: caller }] });
  assert.deepEqual(await presentation.inventoryMovementsJson(Response.json({ data: [movement] })), [movement]);
  assert.deepEqual(await presentation.inventoryWarehouseJson(Response.json({ data: [stock] })), [stock]);
  assert.deepEqual(await presentation.inventoryChartJson(Response.json({ data: [{ date: "2026-10-20", in: 3, out: 1, net: 2 }] })), [{ date: "2026-10-20", in: 3, out: 1, net: 2 }]);
  for (const read of [presentation.inventoryItemJson, presentation.inventoryItemsJson, presentation.inventoryListJson, presentation.inventoryBulkJson, presentation.inventoryDeleteJson, presentation.inventoryImportJson, presentation.inventoryMovementsJson, presentation.inventoryWarehouseJson, presentation.inventoryChartJson]) {
    for (const bad of [null, {}, [], { data: [null] }]) await assert.rejects(read(Response.json(bad)));
    await assert.rejects(read(new Response("private prose")));
    await assert.rejects(read(Response.json(list, { status: 403 })));
  }
  for (const bad of [{ ...item, name: 1 }, { ...item, isActive: "yes" }, { ...item, purchasePriceMinor: "1" }, { ...item, averageCostMinor: "1" }]) await assert.rejects(presentation.inventoryItemJson(Response.json({ inventoryItem: bad })));
  for (const bad of [{ ...list, summary: { ...summary, totalValueMinor: "1" } }, { ...list, categories: [null] }, { ...list, pagination: { page: 0 } }]) await assert.rejects(presentation.inventoryListJson(Response.json(bad)));
  await assert.rejects(presentation.inventoryBulkJson(Response.json({ success: false, affected: 1 })));
  await assert.rejects(presentation.inventoryImportJson(Response.json({ created: 1, updated: 0, errors: [{ row: -1, message: caller }] })));
  await assert.rejects(presentation.inventoryMovementsJson(Response.json({ data: [{ ...movement, valueMinor: "1" }] })));
  await assert.rejects(presentation.inventoryWarehouseJson(Response.json({ data: [{ ...stock, quantity: 1.5 }] })));
});

test("real create/update callbacks preserve canonical fields and exact money, retain forms on failure and always clear busy", async () => {
  for (const locale of locales) for (const file of [drawer, details]) for (const mode of ["success", "status", "json", "shape", "network", "no-org"]) {
    const t = translator(locale), events: unknown[] = [], fields = { code: item.code, name: caller, description: "", sku: "", purchasePrice: "30000000.01", salePrice: "30000000.02", quantityOnHand: "3", reorderPoint: "5" };
    class Form { get(key: keyof typeof fields) { return fields[key]; } }
    const set = (v: unknown) => events.push(v);
    await callback(file, "handleSubmit", { ...presentation, t, inventoryUiItem, catalogPriceMinor, catalogWholeInput,
      FormData: Form, orgId: mode === "no-org" ? null : "org-a", id: item.id, categoryId: item.categoryId,
      invPurchasePrice: fields.purchasePrice, invSalePrice: fields.salePrice, setSaving: set, setItem: (fn: (v: unknown) => unknown) => events.push(fn(item)), setEntityTitle: set,
      localStorage: { getItem: () => mode === "no-org" ? null : "org-a" }, onClose: () => events.push("close"), router: { push: set },
      toast: { success: set, error: set }, fetch: async (url: string, init: RequestInit) => {
        assert.equal(url, `/api/v1/inventory${file === details ? "/" + item.id : ""}`);
        assert.equal(init.method, file === details ? "PATCH" : "POST");
        assert.deepEqual(init.headers, { "Content-Type": "application/json", "x-organization-id": "org-a" });
        assert.deepEqual(JSON.parse(init.body as string), { code: item.code, name: caller, description: null, categoryId: item.categoryId, sku: null, purchasePriceMinor: "3000000001", salePriceMinor: "3000000002", reorderPoint: 5, ...(file === drawer ? { quantityOnHand: 3 } : {}) });
        return response(mode, { inventoryItem: item });
      } })(event);
    assert.deepEqual(events, mode === "no-org" ? [] : mode === "success" ? file === drawer ? [true, t("created"), "close", `/inventory/${item.id}`, false] : [true, item, caller, t("updated"), false] : [true, t(file === drawer ? "createFailed" : "updateFailed"), false]);
  }
});

test("delete callback requires confirmation and a verified success before toast or navigation", async () => {
  for (const locale of locales) for (const mode of ["success", "status", "json", "shape", "network", "cancel", "no-org"]) {
    const t = translator(locale), events: unknown[] = [];
    await callback(details, "handleDelete", { ...presentation, t, orgId: mode === "no-org" ? null : "org-a", id: item.id,
      confirm: async (options: unknown) => { assert.deepEqual(options, { title: t("deleteItemTitle"), description: t("irreversible"), confirmLabel: t("delete"), destructive: true }); return mode !== "cancel"; },
      toast: { success: (v: string) => events.push(v), error: (v: string) => events.push(v) }, router: { push: (v: string) => events.push(v) },
      fetch: async (url: string, init: RequestInit) => { assert.equal(url, `/api/v1/inventory/${item.id}`); assert.deepEqual(init, { method: "DELETE", headers: { "x-organization-id": "org-a" } }); return response(mode, { success: true }); } })();
    assert.deepEqual(events, ["cancel", "no-org"].includes(mode) ? [] : mode === "success" ? [t("deleted"), "/inventory"] : [t("deleteFailed")]);
  }
});

test("adjust, write-down, toggle and revaluation callbacks retain exact operation payloads and reject failed response adoption", async () => {
  for (const locale of locales) for (const name of ["handleAdjust", "handleWriteDown", "handleToggleActive", "handleRevalue"]) for (const mode of ["success", "status", "json", "shape", "network", "no-org"]) {
    const t = translator(locale), events: unknown[] = [], set = (key: string) => (v: unknown) => events.push([key, v]);
    const payload = name === "handleAdjust" ? { adjustment: -1, reason: caller } : name === "handleWriteDown" ? { adjustmentType: "write_down", valueDeltaMinor: "3000000001", reason: caller.trim() } : name === "handleToggleActive" ? { isActive: false } : { adjustmentType: "revaluation", newTotalValueMinor: "3000000001", reason: caller };
    await callback(name === "handleRevalue" ? details : layout, name, { ...presentation, t, item, id: item.id, orgId: mode === "no-org" ? null : "org-a", writeDownBusy: false,
      catalogWholeInput, catalogPriceMinor, inventoryWriteDown, inventoryDetailMoney, inventoryUiItem, formatMoney,
      adjustment: "-1", adjustReason: caller, writeDownAmount: "30000000.01", writeDownReason: caller, revalueValue: "30000000.01", revalueReason: caller, currentBookValue: 6000000002n,
      localStorage: { getItem: () => "org-a" }, confirm: async (options: { description: string }) => { assert.equal(options.description, t("revalueConfirm", { from: "$60,000,000.02", to: "$30,000,000.01" })); return true; },
      adoptItem: (v: unknown) => events.push(v), setItem: (fn: (v: unknown) => unknown) => events.push(fn(item)),
      setAdjustOpen: set("open"), setAdjustment: set("amount"), setAdjustReason: set("reason"), setWriteDownOpen: set("open"), setWriteDownAmount: set("amount"), setWriteDownReason: set("reason"), setWriteDownBusy: set("busy"), setRevalueOpen: set("open"), setRevalueValue: set("amount"), setRevalueReason: set("reason"), setRevalueBusy: set("busy"),
      toast: { success: (v: string) => events.push(v), error: (v: string) => events.push(v) }, fetch: async (url: string, init: RequestInit) => {
        assert.equal(url, `/api/v1/inventory/${item.id}${name === "handleToggleActive" ? "" : "/adjust"}`);
        assert.equal(init.method, name === "handleToggleActive" ? "PATCH" : "POST");
        assert.deepEqual(JSON.parse(init.body as string), payload);
        assert.deepEqual(init.headers, { "Content-Type": "application/json", "x-organization-id": "org-a" });
        return response(mode, { inventoryItem: item });
      } })();
    if (mode === "no-org") assert.deepEqual(events, []);
    else if (mode === "success") assert.deepEqual(events.find(v => v && typeof v === "object" && "id" in v), item, name);
    else {
      assert.ok(!events.some(v => v && typeof v === "object" && "id" in v) && !events.some(v => Array.isArray(v) && ["open", "amount", "reason"].includes(v[0])));
      assert.ok(events.includes(t(name === "handleAdjust" ? "adjustFailed" : name === "handleWriteDown" ? "writeDownFailed" : name === "handleToggleActive" ? "toggleFailed" : "revalueFailed")));
    }
    if (mode !== "no-org" && ["handleWriteDown", "handleRevalue"].includes(name)) assert.deepEqual(events.at(-1), ["busy", false]);
  }
});

test("bulk and import callbacks preserve action/file contracts, retain failed forms and distinguish saved writes from failed refresh", async () => {
  for (const locale of locales) for (const name of ["bulkAction", "handleImport"]) for (const mode of ["success", "status", "json", "shape", "network", "refresh", "no-org"]) {
    const t = translator(locale), events: unknown[] = [], set = (key: string) => (v: unknown) => events.push([key, v]); let calls = 0;
    class Form { append(key: string, file: unknown) { assert.equal(key, "file"); assert.equal(file, caller); } }
    const run = callback(page, name, { ...presentation, t, orgId: mode === "no-org" ? null : "org-a", selectionCount: 1, selected: new Set([item.id]), importFile: caller,
      FormData: Form, pageRef: { current: 1 }, buildUrl: () => "/api/v1/inventory?page=1", inventoryUiItem, inventoryUiListSummary,
      setBulkLoading: set("busy"), setImportLoading: set("busy"), setImportResult: set("result"), setSelected: set("selected"), setItems: set("items"), setTotalCount: set("count"), setHasMore: set("more"), setCategories: set("categories"), setSummary: set("summary"), setReadError: set("error"),
      toast: { success: (v: string) => events.push(v), error: (v: string) => events.push(v) }, fetch: async (url: string, init: RequestInit) => {
        if (++calls === 2) return response(mode === "refresh" ? "status" : "success", list);
        assert.equal(url, `/api/v1/inventory/${name === "bulkAction" ? "bulk" : "import"}`);
        assert.equal(init.method, "POST");
        if (name === "bulkAction") assert.deepEqual(JSON.parse(init.body as string), { action: "adjust_stock", ids: [item.id], adjustment: -1, reason: caller });
        else assert.ok(init.body instanceof Form && !("Content-Type" in (init.headers as object)));
        return response(mode, name === "bulkAction" ? { success: true, affected: 1 } : { created: 1, updated: 0, errors: [] });
      } });
    const result = await (name === "bulkAction" ? run("adjust_stock", { adjustment: -1, reason: caller }) : run());
    if (mode === "no-org") assert.deepEqual(events, []);
    else {
      assert.deepEqual(events.at(-1), ["busy", false]);
      if (["success", "refresh"].includes(mode)) assert.ok(events.includes(t(name === "bulkAction" ? "bulkUpdated" : "imported", { count: 1, created: 1, updated: 0 })));
      else assert.ok(events.includes(t(name === "bulkAction" ? "bulkFailed" : "importFailed")));
      if (mode === "refresh") assert.ok(events.some(v => Array.isArray(v) && v[0] === "error" && v[1] === t("readFailed")));
      if (name === "bulkAction") assert.equal(result, ["success", "refresh"].includes(mode));
    }
  }
});

test("list URL and CSV export keep machine filters, columns, statuses, filename and exact decimal units", () => {
  for (const locale of locales) {
    const t = translator(locale), run = callback(page, "buildUrl", { PAGE_SIZE: 30, debouncedSearch: caller, tab: "low_stock", categoryFilter: "category-a", sortBy: "salePrice", sortOrder: "asc" });
    const url = new URL(run(2), "http://localhost");
    assert.deepEqual(Object.fromEntries(url.searchParams), { page: "2", limit: "30", search: caller, status: "low_stock", categoryId: "category-a", sortBy: "salePrice", sortOrder: "asc" });
    let content: Blob | undefined; const a = { href: "", download: "", click: noop };
    callback(page, "exportCsv", { t, items: [item], toMajorDecimal, money, Blob, URL: { createObjectURL: (blob: Blob) => { content = blob; return "blob:inventory"; }, revokeObjectURL: noop }, document: { createElement: () => a }, toast: { success: noop } })();
    assert.ok(content); assert.match(a.download, /^inventory-\d{4}-\d{2}-\d{2}\.csv$/);
    // Blob text is checked in the separate async export assertion below.
  }
});

test("CSV bytes remain canonical English interchange data in both locales", async () => {
  for (const locale of locales) {
    let content: Blob | undefined;
    callback(page, "exportCsv", { t: translator(locale), items: [item], toMajorDecimal, money, Blob,
      URL: { createObjectURL: (blob: Blob) => { content = blob; return "blob:inventory"; }, revokeObjectURL: noop }, document: { createElement: () => ({ click: noop }) }, toast: { success: noop } })();
    const csv = await content!.text();
    assert.equal(csv.split("\n")[0], '"Code","Name","Category","SKU","Quantity","Reorder Point","Purchase Price","Sale Price","Status"');
    assert.ok(csv.includes('"30000000.01","30000000.02","Active"') && csv.includes('""name""'));
  }
});

test("picker reads require HTTP/shape/money validity, suppress cancelled responses and retain canonical lookup URLs", async () => {
  for (const locale of locales) for (const selected of [false, true]) for (const mode of ["success", "status", "json", "shape", "network", "cancelled"]) {
    const t = translator(locale), events: unknown[] = [], effects: Effect[] = [];
    const Picker = loaded(picker, { open: true, search: caller }, [], events, effects, { fetch: async (url: string, init: RequestInit) => {
      assert.equal(url, selected ? `/api/v1/inventory/${item.id}` : `/api/v1/inventory?${new URLSearchParams({ limit: "50", search: caller })}`);
      assert.deepEqual(init, { headers: { "x-organization-id": "org-a" } });
      return response(mode, selected ? { inventoryItem: item } : { data: [item] });
    } });
    renderWithPresentation(createElement(Picker, { value: selected ? item.id : "", onChange: noop }), locale);
    const cleanup = effects[selected ? 1 : 0](); if (mode === "cancelled" && cleanup) cleanup();
    await flush();
    if (mode === "cancelled") assert.deepEqual(events, []);
    else if (mode === "success") assert.ok(events.some(v => Array.isArray(v) && v[0] === (selected ? "selected" : "items")));
    else assert.ok(events.some(v => Array.isArray(v) && v[0] === "readError" && v[1] === t(selected ? "selectedReadFailed" : "pickerReadFailed")));
  }
});

test("barcode print escapes caller HTML and localizes authored title without changing barcode data", () => {
  for (const locale of locales) {
    const t = translator(locale); let html = "", value = "";
    callback(details, "printBarcode", { ...presentation, t, item,
      document: { createElement: () => ({ toDataURL: () => "data:image/png;base64,AA==" }) },
      JsBarcode: (_canvas: unknown, text: string) => { value = text; },
      window: { open: () => ({ document: { write: (v: string) => { html = v; }, close: noop } }) }, toast: { error: noop } })();
    assert.equal(value, item.sku);
    assert.ok(html.includes(presentation.inventoryPrintEscape(t("barcodeTitle", { name: caller }))) && !html.includes(caller));
    assert.equal((html.match(/<script>/g) || []).length, 1);
  }
});

test("production list, history and warehouse read effects retain prior data on failed or cancelled reads", async () => {
  for (const locale of locales) for (const file of [page, history, details]) for (const mode of ["success", "status", "json", "shape", "network", "cancelled"]) {
    const t = translator(locale), events: unknown[] = [], effects: Effect[] = [];
    const Page = loaded(file, { loading: false, items: [item] }, [], events, effects, { fetch: async (url: string, init: RequestInit) => {
      assert.equal(url, file === page ? "/api/v1/inventory?page=1&limit=30&sortBy=createdAt&sortOrder=desc" : `/api/v1/inventory/${item.id}/${file === history ? "movements?limit=50" : "warehouse-stock"}`);
      assert.deepEqual(init, { headers: { "x-organization-id": "org-a" } });
      return response(mode, file === page ? list : { data: file === history ? [movement] : [stock] });
    } });
    renderWithPresentation(createElement(Page), locale); events.length = 0;
    const cleanup = effects[file === page ? 2 : 0]();
    if (mode === "cancelled" && cleanup) cleanup();
    await flush();
    const dataKey = file === page ? "items" : file === history ? "movements" : "warehouseStocks";
    const adoption = events.find(v => Array.isArray(v) && v[0] === dataKey);
    if (mode === "success") assert.ok(adoption, `${file}/${mode}`);
    else assert.equal(adoption, undefined, `${file}/${mode}`);
    if (!["success", "cancelled"].includes(mode)) {
      const error = t(file === page ? "readFailed" : "historyReadFailed");
      assert.ok(events.includes(error) || events.some(v => Array.isArray(v) && v[0] === "readError" && v[1] === error));
    }
    assert.ok(!JSON.stringify(events).includes("private server prose"));
  }
});

test("workspace read callback validates identity and exact money, clears loading and suppresses aborted reads", async () => {
  for (const locale of locales) for (const mode of ["success", "status", "json", "shape", "network", "cancelled", "no-org"]) {
    const t = translator(locale), events: unknown[] = [], set = (key: string) => (v: unknown) => events.push([key, v]);
    const readController = { current: null as AbortController | null };
    const cleanup = callback(layout, "fetchItem", { ...presentation, t, orgId: mode === "no-org" ? null : "org-a", id: item.id, readController, AbortController,
      inventoryDetailMoney, setLoading: set("loading"), setItemRaw: set("item"), setReadError: set("error"), setEntityTitle: set("title"),
      fetch: async (url: string, init: RequestInit) => {
        assert.equal(url, `/api/v1/inventory/${item.id}`);
        assert.deepEqual(init.headers, { "x-organization-id": "org-a" });
        assert.ok(init.signal instanceof AbortSignal);
        return response(mode, { inventoryItem: item });
      } })();
    if (mode === "cancelled") cleanup();
    await flush();
    if (mode === "success") assert.deepEqual(events.at(-3), ["item", item]);
    else assert.ok(!events.some(v => Array.isArray(v) && v[0] === "item" && v[1] !== null));
    if (!["cancelled", "no-org", "success"].includes(mode)) assert.deepEqual(events.at(-2), ["error", t("readFailed")]);
    if (mode !== "cancelled") assert.deepEqual(events.at(-1), ["loading", false]);
  }
});

test("owned copy is cataloged, parser prose cannot escape, and Persian messages contain Persian script", () => {
  for (const file of [page, details, layout, history, drawer, picker]) {
    const ast = parse(file), owner = file === drawer ? ast.statements.filter(n => ts.isFunctionDeclaration(n) && n.name?.text === "InventoryDrawer") : [ast];
    function visit(n: ts.Node) {
      if (ts.isJsxText(n)) assert.ok(!/[A-Za-z]/.test(n.text.replaceAll("&rarr;", "→")), n.text.trim());
      if (ts.isJsxAttribute(n) && ["title", "description", "placeholder", "aria-label", "alt", "label"].includes(n.name.getText(ast)) && n.initializer && ts.isStringLiteral(n.initializer)) assert.ok(["ITEM-001", "0.00"].includes(n.initializer.text), n.getText(ast));
      if (ts.isCallExpression(n) && /^(toast\.(success|error)|useDocumentTitle)$/.test(n.expression.getText(ast))) assert.ok(!n.arguments.some(ts.isStringLiteral), n.getText(ast));
      ts.forEachChild(n, visit);
    }
    owner.forEach(visit);
    assert.doesNotMatch(file === drawer ? owner[0].getText(ast) : ast.text, /toast\.error\([^\n]*(?:err|error)\.message/);
  }
  for (const value of Object.values(fa.InventoryItems)) assert.match(value, /[\u0600-\u06ff]/);
  assert.equal(presentation.inventoryMovementKey("constructor"), null);
  assert.equal(presentation.inventoryWriteDownError(new Error("private prose")), "writeDownInvalid");
});
