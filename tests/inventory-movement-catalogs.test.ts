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
import * as readers from "../i18n/inventory-movement-presentation";
import { inventoryTransferLines } from "../lib/money/inventory-ui";
import { catalogWholeInput } from "../lib/money/catalog-input";
import * as BrandLoader from "../components/dashboard/brand-loader";
import { renderWithPresentation } from "./helpers/presentation";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";

const page = "app/(dashboard)/inventory/stock-takes/page.tsx";
const detail = "app/(dashboard)/inventory/stock-takes/[id]/page.tsx";
const transfer = "app/(dashboard)/inventory/transfers/page.tsx";
const drawer = "components/dashboard/create-drawer.tsx";
const locales = ["en-US", "fa-IR"] as const;
const noop = () => {};
const caller = '<script>caller & location</script>';
const location = { id: "wh-a", name: caller, code: "WH-001" };
const line = { id: "line-a", inventoryItemId: "item-a", inventoryItem: { id: "item-a", name: caller, code: "ITEM-A" }, expectedQuantity: 6, countedQuantity: null, discrepancy: null, adjusted: null, valueAdjustment: null, valueAdjustmentMinor: null };
const take = { id: "take-a", name: caller, notes: caller, status: "in_progress", warehouse: location, createdAt: "2026-10-20T00:00:00Z", updatedAt: "2026-10-20T00:00:00Z", completedAt: null, lines: [line] };
const moved = { id: "move-a", fromWarehouse: location, toWarehouse: { ...location, id: "wh-b", name: "Destination", code: "WH-002" }, status: "draft", notes: caller, createdAt: take.createdAt, completedAt: null, lines: [{ id: "line-b", inventoryItemId: line.inventoryItemId, quantity: 2, receivedQuantity: null }] };
const escape = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#x27;");
function translator(locale: typeof locales[number]) { return createTranslator({ locale, messages: locale === "en-US" ? en : fa, namespace: "InventoryMovements" }); }
function parse(file: string) { return ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX); }
type Captured = { kind: string; props: Record<string, unknown> };

// Production templates/controls and next-intl; controlled hooks and inline
// portal boundaries expose forms and callbacks without mounting a browser.
function loaded(file: string, states: Record<string, unknown> = {}, captured: Captured[] = [], events: unknown[] = [], selectedName?: string) {
  const ast = parse(file), name = selectedName ?? (file === page ? "StockTakesPage" : file === detail ? "StockTakeDetailPage" : file === transfer ? "TransfersPage" : "StockTakeDrawer");
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
    if (id === "next/navigation") return { useParams: () => ({ id: take.id }), usePathname: () => "/inventory", useRouter: () => ({ push: noop }) };
    if (id.endsWith("/create-drawer")) return { useCreateDrawer: () => ({ open: (kind: string) => events.push(kind) }) };
    if (id.endsWith("/use-confirm")) return { useConfirm: () => ({ confirm: noop, dialog: null }) };
    if (id.endsWith("/use-debounce")) return { useDebounce: (v: string) => states.debouncedSearch ?? v };
    if (id.endsWith("/use-document-title")) return { useDocumentTitle: (v: string) => events.push(v) };
    if (id.endsWith("/warehouse-picker")) return { WarehousePicker: inline("WarehousePicker") };
    if (id.endsWith("/inventory-item-picker")) return { InventoryItemPicker: inline("InventoryItemPicker") };
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

function callback(file: string, name: string, scope: Record<string, unknown> = {}, ownerName = "StockTakeDrawer") {
  const ast = parse(file); let expression = "";
  function visit(n: ts.Node) {
    if (ts.isFunctionDeclaration(n) && n.name?.text === name) expression = n.getText(ast);
    if (ts.isVariableDeclaration(n) && n.name.getText(ast) === name && n.initializer && ts.isCallExpression(n.initializer)) expression = n.initializer.arguments[0].getText(ast);
    ts.forEachChild(n, visit);
  }
  const owner = file === drawer ? ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === ownerName)! : ast;
  visit(owner); assert.ok(expression, name);
  const code = ts.transpileModule(`const run = ${expression};`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  return new Function(...Object.keys(scope), `${code}; return run;`)(...Object.values(scope));
}
const event = { preventDefault: noop, stopPropagation: noop, currentTarget: {} };
const flush = async () => { for (let i = 0; i < 6; i++) await new Promise(resolve => setImmediate(resolve)); };

test("movement catalogs render real bilingual stock-take lists, examples, statuses and caller escaping", () => {
  for (const locale of locales) {
    const t = translator(locale);
    for (const empty of [true, false]) {
      const captured: Captured[] = [];
      const Page = loaded(page, { loading: false, stockTakes: empty ? [] : ["draft", "in_progress", "completed", "cancelled"].map((status, i) => ({ ...take, id: String(i), status, itemCount: i })) }, captured);
      const html = renderWithPresentation(createElement(Page), locale);
      for (const key of empty ? ["physicalCounts", "accurateRecords", "newStockTake", "exampleCount"] as const : ["stockTakes", "stockDescription", "draft", "inProgress", "completed", "cancelled"] as const) assert.ok(html.includes(escape(t(key))), key);
      if (!empty) {
        assert.ok(html.includes(escape(caller)) && !html.includes("<script>"));
        assert.ok(html.includes(escape(t("itemCount", { count: 1 }))));
        assert.deepEqual(captured.filter(c => c.kind === "TabsTrigger").map(c => c.props.value), ["all", "draft", "in_progress", "completed"]);
      }
    }
  }
});

test("stock detail renders counting, completed, empty, error and missing states with canonical controls", () => {
  for (const locale of locales) for (const status of ["draft", "in_progress", "completed", "cancelled"]) {
    const t = translator(locale), captured: Captured[] = [];
    const Page = loaded(detail, { loading: false, stockTake: { ...take, status, lines: [line, { ...line, id: "matched", countedQuantity: 6, discrepancy: 0, adjusted: true }, { ...line, id: "diff", countedQuantity: 5, discrepancy: -1 }] } }, captured);
    const html = renderWithPresentation(createElement(Page), locale);
    assert.ok(html.includes(escape(caller)) && !html.includes("<script>"));
    assert.ok(html.includes(escape(t("backStockLink"))));
    assert.deepEqual(captured.filter(c => c.kind === "SelectItem").map(c => c.props.value), ["name", "code", "expected", "counted", "discrepancy"]);
    assert.deepEqual(captured.filter(c => c.kind === "TabsTrigger").map(c => c.props.value), ["all", "uncounted", "matched", "discrepancies"]);
    assert.ok(html.includes(escape(t(status === "draft" ? "startCount" : status === "in_progress" ? "finalizeAdjustment" : "countingProgress"))));
  }
  for (const locale of locales) for (const [states, key] of [[{ stockTake: null }, "stockNotFound"], [{ readError: true }, "stockReadFailed"], [{ stockTake: { ...take, lines: [] } }, "noStockItems"]] as const) {
    const Page = loaded(detail, { loading: false, ...states });
    assert.ok(renderWithPresentation(createElement(Page), locale).includes(escape(translator(locale)(key))));
  }
});

test("transfer examples and detail localize plurals, dates and unknown items without changing controls", () => {
  for (const locale of locales) for (const empty of [true, false]) {
    const captured: Captured[] = [], t = translator(locale);
    const Page = loaded(transfer, { loading: false, transfers: empty ? [] : [moved], activeTransfer: { ...moved, completedAt: take.createdAt }, detailOpen: true }, captured);
    const html = renderWithPresentation(createElement(Page), locale);
    for (const key of empty ? ["stockTransfers", "moveLocations", "exampleWidget", "newTransfer"] as const : ["transferDetails", "unknownItem", "totalUnits", "complete", "cancel"] as const) assert.ok(html.includes(escape(t(key))), key);
    if (!empty) {
      assert.ok(html.includes(escape(caller)) && !html.includes("<script>"));
      assert.ok(html.includes(escape(t("unitCount", { count: 2 }))));
      assert.deepEqual(captured.filter(c => c.kind === "TabsTrigger").map(c => c.props.value), ["all", "draft", "in_transit", "completed", "cancelled"]);
      assert.deepEqual(captured.filter(c => c.kind === "SelectItem").map(c => c.props.value), ["createdAt", "fromWarehouse", "toWarehouse", "items", "status"]);
    }
  }
});

test("movement drawers render translated shared footers, whole-unit labels and stable warehouse/item values", () => {
  for (const locale of locales) for (const name of ["StockTakeDrawer", "TransferDrawer"]) for (const saving of [false, true]) {
    const captured: Captured[] = [], events: unknown[] = [], t = translator(locale);
    const Drawer = loaded(drawer, { saving, warehouseId: "wh-a", fromWarehouseId: "wh-a", toWarehouseId: "wh-b", lines: [{ inventoryItemId: "item-a", quantity: "2" }, { inventoryItemId: "item-b", quantity: "3" }] }, captured, events, name);
    const html = renderWithPresentation(createElement(Drawer, { open: true, onClose: noop }), locale);
    assert.ok(html.includes(escape(t("cancel"))));
    assert.ok(html.includes(escape(t(saving ? "creating" : name === "StockTakeDrawer" ? "createStock" : "createTransfer"))));
    const picks = captured.filter(c => c.kind === "WarehousePicker");
    assert.deepEqual(picks.map(c => c.props.value), name === "StockTakeDrawer" ? ["wh-a"] : ["wh-a", "wh-b"]);
    if (name === "TransferDrawer") {
      assert.ok(html.includes(escape(t("transferQuantity"))) && html.includes(escape(t("removeItem"))));
      (captured.find(c => c.kind === "InventoryItemPicker")!.props.onChange as (v: string) => void)("selected-id");
      const update = (events.at(-1) as [string, (v: unknown[]) => unknown[]])[1];
      assert.deepEqual(update([{ inventoryItemId: "old", quantity: "2" }]), [{ inventoryItemId: "selected-id", quantity: "2" }]);
    }
  }
});

test("movement display readers reject failed HTTP, malformed envelopes, invalid units and mismatched exact-money aliases", async () => {
  assert.equal((await readers.movementStockJson(Response.json({ stockTake: take }))).lines[0].adjusted, null);
  assert.deepEqual(await readers.movementTransfersJson(Response.json({ data: [moved] })), [moved]);
  await readers.movementStockCreatedJson(Response.json({ stockTake: { ...take, lines: undefined } }));
  for (const read of [readers.movementStockJson, readers.movementStockListJson, readers.movementTransferJson, readers.movementTransfersJson, readers.movementItemsJson, readers.movementStockCreatedJson, readers.movementAppliedJson]) {
    for (const response of [Response.json({ error: "private" }, { status: 403 }), new Response("private"), Response.json({}), Response.json(null)]) await assert.rejects(() => read(response));
  }
  for (const patch of [{ quantity: 1.5 }, { quantity: 2147483648 }, { quantity: 0 }, { quantity: -0 }, { receivedQuantity: -1 }]) assert.throws(() => readers.movementTransfer({ ...moved, lines: [{ ...moved.lines[0], ...patch }] }));
  for (const patch of [{ countedQuantity: 1.2, discrepancy: 0 }, { valueAdjustment: 9007199254740992, valueAdjustmentMinor: "9007199254740992" }, { valueAdjustment: 29, valueAdjustmentMinor: "30" }, { inventoryItem: {} }, { adjusted: "false" }]) assert.throws(() => readers.movementStockDetail({ ...take, lines: [{ ...line, ...patch }] }));
  const applied = { ...line, countedQuantity: 5, discrepancy: -2, adjusted: true, valueAdjustment: -58, valueAdjustmentMinor: "-58" };
  assert.equal(readers.movementStockDetail({ ...take, status: "completed", lines: [applied] }).lines[0].discrepancy, -2);
});

test("stock-take counting preserves whole units, refuses out-of-range input, and localizes input feedback", () => {
  for (const locale of locales) for (const editValue of ["", "6", "5", "0", "-1", "1.2", "2147483648"]) {
    const events: unknown[] = [], t = translator(locale);
    callback(detail, "handleBlur", { t, editValue, line: { ...line, countedQuantity: 6 }, catalogWholeInput, setEditing: noop, toast: { error: (v: string) => events.push(v) }, onUpdate: (...v: unknown[]) => events.push(v) })();
    assert.deepEqual(events, ["", "6"].includes(editValue) ? [] : ["5", "0"].includes(editValue) ? [[line.id, Number(editValue)]] : [t("invalidCount")]);
  }
});

test("movement creation callbacks preserve payloads, retain forms on failures, and always end busy state", async () => {
  for (const locale of locales) for (const name of ["StockTakeDrawer", "TransferDrawer"]) for (const mode of ["success", "status", "json", "shape", "network", "no-org", "invalid-units", "no-warehouse"]) {
    const events: unknown[] = [], t = translator(locale), stock = name === "StockTakeDrawer";
    class Form { get(key: string) { return key === "name" ? caller : caller; } }
    await callback(drawer, "handleSubmit", { t, ...readers, FormData: Form, warehouseId: "wh-a", fromWarehouseId: mode === "no-warehouse" ? "" : "wh-a", toWarehouseId: "wh-b", lines: [{ inventoryItemId: "item-a", quantity: mode === "invalid-units" ? "1.5" : "2" }], inventoryTransferLines,
      localStorage: { getItem: () => mode === "no-org" ? null : "org-a" }, setSaving: (v: boolean) => events.push(["busy", v]), onClose: () => events.push("close"), resetState: () => events.push("reset"), window: { dispatchEvent: (e: Event) => events.push(e.type) }, toast: { success: (v: string) => events.push(["success", v]), error: (v: string) => events.push(["error", v]) },
      fetch: async (url: string, init: RequestInit) => {
        assert.equal(url, stock ? "/api/v1/stock-takes" : "/api/v1/inventory/transfers"); assert.equal(init.method, "POST");
        assert.deepEqual(init.headers, { "Content-Type": "application/json", "x-organization-id": "org-a" });
        assert.deepEqual(JSON.parse(init.body as string), stock ? { name: caller, warehouseId: "wh-a", notes: caller } : { fromWarehouseId: "wh-a", toWarehouseId: "wh-b", notes: caller, lines: [{ inventoryItemId: "item-a", quantity: 2 }] });
        if (mode === "network") throw Error("private");
        return mode === "json" ? new Response("private") : Response.json(mode === "shape" ? {} : stock ? { stockTake: take } : { transfer: moved }, { status: mode === "status" ? 403 : 200 });
      } }, name)({ ...event, currentTarget: { elements: { namedItem: () => ({ value: caller }) } } });
    const success = mode === "success" || stock && ["invalid-units", "no-warehouse"].includes(mode);
    assert.ok(!JSON.stringify(events).includes("private"));
    if (mode === "no-org") assert.deepEqual(events, [["error", t("organizationRequired")]]);
    else if (success) assert.deepEqual(events, [["busy", true], ["success", t(stock ? "stockCreated" : "transferCreated")], "close", ...stock ? [] : ["reset"], stock ? "refetch-stock-takes" : "refetch-transfers", ["busy", false]]);
    else { assert.ok(!events.includes("close")); assert.deepEqual(events.at(-1), ["busy", false]); assert.ok(events.some(v => Array.isArray(v) && v[0] === "error")); }
  }
});

test("stock start/cancel/delete and transfer complete/cancel callbacks require verified success before changing UI", async () => {
  for (const locale of locales) for (const [file, name, errorKey, successKey] of [[detail, "handleStartCount", "startFailed", "started"], [detail, "handleCancel", "cancelStockFailed", "stockCancelled"], [detail, "handleDelete", "deleteStockFailed", "stockDeleted"], [transfer, "handleComplete", "completeFailed", "transferCompleted"], [transfer, "handleCancel", "cancelTransferFailed", "transferCancelled"]] as const) for (const mode of ["success", "status", "shape", "json", "network", "no-org", "cancel"]) {
    const events: unknown[] = [], t = translator(locale), isStock = file === detail, deleting = name === "handleDelete";
    await callback(file, name, { t, ...readers, orgId: mode === "no-org" ? null : "org-a", id: take.id, confirm: async (opts: Record<string, unknown>) => { assert.equal(opts.cancelLabel, t("cancel")); return mode !== "cancel"; }, setActionLoading: noop, setCompleting: noop, setStockTake: (v: unknown) => events.push(["adopt", v]), setDetailOpen: (v: unknown) => events.push(["open", v]), setActiveTransfer: noop, fetchTransfers: noop, router: { push: (v: string) => events.push(v) }, toast: { success: (v: string) => events.push(["success", v]), error: (v: string) => events.push(["error", v]) },
      fetch: async (url: string, init: RequestInit) => {
        const base = isStock ? "/api/v1/stock-takes/take-a" : "/api/v1/inventory/transfers/move-a";
        assert.equal(url, base + (name === "handleComplete" ? "/complete" : ""));
        assert.equal((init.headers as Record<string, string>)["x-organization-id"], "org-a");
        assert.equal(init.method, deleting ? "DELETE" : name === "handleComplete" ? "POST" : "PATCH");
        if (init.method === "PATCH") assert.deepEqual(JSON.parse(init.body as string), { status: name === "handleStartCount" ? "in_progress" : "cancelled" });
        if (mode === "network") throw Error("private");
        return mode === "json" ? new Response("private") : Response.json(mode === "shape" ? {} : deleting ? { success: true } : isStock ? { stockTake: take } : { transfer: moved }, { status: mode === "status" ? 409 : 200 });
      } })(moved);
    if (mode === "no-org") assert.deepEqual(events, [["error", t("organizationRequired")]]);
    else if (mode === "cancel" && name !== "handleStartCount") assert.deepEqual(events, []);
    else if (["status", "shape", "json", "network"].includes(mode)) assert.deepEqual(events, [["error", t(errorKey)]]);
    else assert.ok(events.some(v => Array.isArray(v) && v[0] === "success" && v[1] === t(successKey)));
  }
});

test("posting uses verified complete response when follow-up read fails and keeps adjusted-count ICU feedback", async () => {
  for (const locale of locales) for (const mode of ["success", "refetch-failed", "status", "shape", "json", "cancel", "no-org"]) {
    const t = translator(locale), events: unknown[] = [], posted = { ...take, status: "completed" };
    await callback(detail, "handleApplyAdjustments", { t, ...readers, orgId: mode === "no-org" ? null : "org-a", id: take.id, setActionLoading: noop, setStockTake: (v: unknown) => events.push(v), confirm: async () => mode !== "cancel", toast: { success: (v: string) => events.push(v), error: (v: string) => events.push(v) }, fetch: async (url: string, init: RequestInit) => {
      assert.equal((init.headers as Record<string, string>)["x-organization-id"], "org-a");
      if (url.endsWith("/apply")) { assert.equal(init.method, "POST"); return mode === "json" ? new Response("private") : Response.json(mode === "shape" ? {} : { stockTake: posted, adjustedCount: 2 }, { status: mode === "status" ? 400 : 200 }); }
      return Response.json({ stockTake: posted }, { status: mode === "refetch-failed" ? 403 : 200 });
    } })();
    assert.deepEqual(events, mode === "no-org" ? [t("organizationRequired")] : mode === "cancel" ? [] : ["status", "shape", "json"].includes(mode) ? [t("postFailed")] : [posted, t("adjustmentPosted", { count: 2 })]);
  }
});

test("count mutation validates saved aliases, returns failure to bulk and restores only the failed optimistic line", async () => {
  for (const locale of locales) for (const mode of ["success", "status", "shape", "json", "network"]) {
    const t = translator(locale), other = { ...line, id: "other", countedQuantity: 9, discrepancy: 3 }, state = { ...take, lines: [line, other] }, errors: string[] = [];
    const result = await callback(detail, "handleUpdateLine", { t, ...readers, orgId: "org-a", id: take.id, stockTake: take, setSavingLines: noop, setStockTake: (fn: (s: typeof state) => typeof state) => Object.assign(state, fn(state)), toast: { error: (v: string) => errors.push(v) }, fetch: async (url: string, init: RequestInit) => {
      assert.equal(url, "/api/v1/stock-takes/take-a/lines/line-a"); assert.equal(init.method, "PATCH"); assert.deepEqual(JSON.parse(init.body as string), { countedQuantity: 5 });
      if (mode === "network") throw Error("private");
      return mode === "json" ? new Response("private") : Response.json({ line: mode === "shape" ? {} : { ...line, countedQuantity: 5, discrepancy: -1 } }, { status: mode === "status" ? 403 : 200 });
    } })(line.id, 5);
    assert.equal(result, mode === "success"); assert.deepEqual(state.lines[1], other);
    assert.equal(state.lines[0].countedQuantity, mode === "success" ? 5 : null);
    assert.deepEqual(errors, mode === "success" ? [] : [t("updateCountFailed")]);
  }
  for (const locale of locales) for (const success of [false, true]) {
    const events: string[] = [], t = translator(locale);
    await callback(detail, "handleConfirmAllRemaining", { t, orgId: "org-a", stockTake: take, confirm: async () => true, setConfirmingAll: noop, handleUpdateLine: async (id: string, qty: number) => { assert.equal(id, line.id); assert.equal(qty, 6); return success; }, toast: { success: (v: string) => events.push(v), error: (v: string) => events.push(v) } })();
    assert.deepEqual(events, [success ? t("confirmedItems", { count: 1 }) : t("bulkFailed")]);
  }
});

test("paired movement Persian copy contains Persian script and dynamic plurals retain counts and caller data", () => {
  assert.deepEqual(Object.keys(en.InventoryMovements), Object.keys(fa.InventoryMovements));
  for (const [key, value] of Object.entries(fa.InventoryMovements)) if (key !== "statusCount") assert.match(value, /[\u0600-\u06ff]/, key);
  for (const locale of locales) for (const count of [0, 1, 2, 2147483647]) {
    const t = translator(locale);
    for (const key of ["itemCount", "unitCount", "adjustmentPosted", "confirmedItems", "exampleDiscrepancies"] as const) assert.ok(!/MISSING|INVALID/.test(t(key, { count })));
    assert.ok(t("createdDate", { date: caller }).includes(caller));
  }
});

function effect(file: string, scope: Record<string, unknown>, index = 0) {
  const ast = parse(file), effects: ts.CallExpression[] = [];
  function visit(n: ts.Node) { if (ts.isCallExpression(n) && n.expression.getText(ast) === "useEffect") effects.push(n); ts.forEachChild(n, visit); }
  visit(ast);
  const code = ts.transpileModule(`const run = ${effects[index].arguments[0].getText(ast)};`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  return new Function(...Object.keys(scope), `${code}; return run;`)(...Object.values(scope));
}

test("stock-take list/detail reads validate before adoption and ignore disposed and superseded requests", async () => {
  for (const file of [page, detail]) for (const mode of ["success", "status", "shape", "json", "network", "no-org", "dispose", "stale"]) {
    const events: unknown[] = [], requestId = { current: 0 }, handlers: (() => void)[] = [];
    const run = effect(file, { ...readers, requestId, orgId: mode === "no-org" ? null : "org-a", id: take.id, localStorage: { getItem: () => mode === "no-org" ? null : "org-a" }, setLoading: noop, setReadFailed: (v: boolean) => { if (v) events.push("error"); }, setReadError: (v: boolean) => { if (v) events.push("error"); }, setStockTakes: (v: unknown) => events.push(v), setStockTake: (v: unknown) => events.push(v), window: { addEventListener: (_: string, fn: () => void) => handlers.push(fn), removeEventListener: noop }, fetch: async (url: string, init: RequestInit) => {
      assert.equal(url, file === page ? "/api/v1/stock-takes" : "/api/v1/stock-takes/take-a"); assert.deepEqual(init.headers, { "x-organization-id": "org-a" });
      if (mode === "network") throw Error("private");
      return mode === "json" ? new Response("private") : Response.json(mode === "shape" ? {} : file === page ? { stockTakes: [{ ...take, itemCount: 1 }] } : { stockTake: take }, { status: mode === "status" ? 403 : 200 });
    } });
    const cleanup = run();
    if (mode === "dispose") cleanup?.();
    if (mode === "stale" && file === page) ++requestId.current;
    await flush();
    assert.deepEqual(events, mode === "dispose" || mode === "stale" && file === page ? [] : ["success", "stale"].includes(mode) ? [file === page ? [{ ...take, itemCount: 1 }] : take] : ["error"]);
  }
});

test("transfer reads retain valid rows on errors and suppress superseded results", async () => {
  for (const mode of ["success", "status", "shape", "json", "network", "no-org", "dispose", "stale"]) {
    const events: unknown[] = [], requestId = { current: 0 }, mounted = { current: true };
    await callback(transfer, "fetchTransfers", { ...readers, requestId, mounted, orgId: mode === "no-org" ? null : "org-a", setLoading: noop, setRefetching: noop, setFetchKey: noop, setReadFailed: (v: boolean) => { if (v) events.push("error"); }, setTransfers: (v: unknown) => events.push(v), fetch: async (url: string, init: RequestInit) => {
      assert.equal(url, "/api/v1/inventory/transfers"); assert.deepEqual(init.headers, { "x-organization-id": "org-a" });
      if (mode === "dispose") mounted.current = false;
      if (mode === "stale") ++requestId.current;
      if (mode === "network") throw Error("private");
      return mode === "json" ? new Response("private") : Response.json(mode === "shape" ? {} : { data: [moved] }, { status: mode === "status" ? 403 : 200 });
    } })();
    assert.deepEqual(events, mode === "dispose" || mode === "stale" ? [] : mode === "success" ? [[moved]] : ["error"]);
  }
});

test("movement source audit leaves only explicit warehouse identifiers and punctuation as authored JSX text", () => {
  for (const file of [page, detail, transfer, drawer]) {
    const ast = parse(file);
    const owners: ts.Node[] = file === drawer ? ast.statements.filter(n => ts.isFunctionDeclaration(n) && ["StockTakeDrawer", "TransferDrawer"].includes(n.name?.text ?? "")) : [ast];
    function audit(n: ts.Node) {
      if (ts.isJsxText(n) && /[A-Za-z]/.test(n.text)) assert.ok(["WH-001", "WH-002"].includes(n.text.trim()), `${file}: ${n.text}`);
      if (ts.isJsxAttribute(n) && ["placeholder", "title", "aria-label"].includes(n.name.getText(ast)) && n.initializer && ts.isStringLiteral(n.initializer)) assert.equal(n.initializer.text, "-");
      ts.forEachChild(n, audit);
    }
    owners.forEach(audit);
  }
});
