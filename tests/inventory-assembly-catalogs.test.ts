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
import * as readers from "../i18n/inventory-assembly-presentation";
import * as BrandLoader from "../components/dashboard/brand-loader";
import { expenseMoneyDisplay } from "../lib/money/expense-display";
import { renderWithPresentation } from "./helpers/presentation";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";

const list = "app/(dashboard)/inventory/bom/page.tsx";
const detail = "app/(dashboard)/inventory/bom/[id]/page.tsx";
const orders = "app/(dashboard)/inventory/assembly/page.tsx";
const locales = ["en-US", "fa-IR"] as const;
const noop = () => {};
const caller = '<script>caller & recipe</script>';
const item = { id: "item-a", name: caller, code: "ITEM-A", purchasePrice: 3000000001, purchasePriceMinor: "3000000001",
  salePrice: 3000000002, salePriceMinor: "3000000002", quantityOnHand: 3, totalValue: 6000000002, totalValueMinor: "6000000002",
  priceValue: 9000000003, priceValueMinor: "9000000003", averageCost: 2000000001, averageCostMinor: "2000000001",
  standardCost: 0, standardCostMinor: "0", reorderPoint: 0 };
const costs = { componentCost: 1650000001, componentCostMinor: "1650000001", laborCost: 1, laborCostMinor: "1",
  overheadCost: 2, overheadCostMinor: "2", totalCost: 1650000004, totalCostMinor: "1650000004" };
const component = { id: "component-a", componentItem: item, quantity: "0.50000000", quantityExact: "0.5", wastagePercent: "10.0000", wastagePercentExact: "10" };
const bom = { id: "bom-a", name: caller, description: caller, isActive: false, currencyCode: "USD", assemblyItem: item,
  laborCostCents: 1, laborCostCentsMinor: "1", overheadCostCents: 2, overheadCostCentsMinor: "2", components: [component], costBreakdown: costs };
const data = { bom, costBreakdown: costs };
const order = { id: "order-a", quantity: 3, status: "draft", notes: caller, createdAt: "2026-10-20T00:00:00Z", completedAt: null, bom };
const escape = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#x27;");
function translator(locale: typeof locales[number]) { return createTranslator({ locale, messages: locale === "en-US" ? en : fa, namespace: "InventoryAssembly" }); }
function parse(file: string) { return ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX); }

// Actual production JSX and next-intl. Hooks and portals are controlled to
// inspect saved/empty/error states without claiming mounted-browser coverage.
function loaded(file: string, states: Record<string, unknown>, events: unknown[] = []) {
  const ast = parse(file);
  const names: string[] = [];
  function visit(n: ts.Node) {
    if (ts.isVariableDeclaration(n) && ts.isArrayBindingPattern(n.name) && n.initializer && ts.isCallExpression(n.initializer) && n.initializer.expression.getText(ast) === "useState") names.push(n.name.elements[0].getText(ast));
    ts.forEachChild(n, visit);
  }
  visit(ast);
  const require = createRequire(resolve(file)), compiled = { exports: {} as Record<string, ComponentType> };
  let index = 0;
  const load = (id: string): unknown => {
    if (id === "react") return { ...React, useState: (initial: unknown) => { const key = names[index++]; return [Object.hasOwn(states, key) ? states[key] : initial, noop]; }, useEffect: noop };
    if (id === "next-intl") return nextIntl;
    if (id === "next/navigation") return { useParams: () => ({ id: bom.id }), useRouter: () => ({ push: noop }) };
    if (id.endsWith("/use-document-title")) return { useDocumentTitle: (v: string) => events.push(v) };
    if (id.endsWith("/brand-loader")) return BrandLoader;
    if (id.endsWith("/use-confirm")) return { useConfirm: () => ({ confirm: noop, dialog: null }) };
    if (id.endsWith("/ui/dropdown-menu")) return Object.fromEntries(["DropdownMenu", "DropdownMenuContent", "DropdownMenuItem", "DropdownMenuTrigger"].map(key => [key, (props: { children: ReactNode }) => createElement("div", null, props.children)]));
    return require(id.startsWith("@/") ? resolve(id.slice(2)) : id);
  };
  const code = ts.transpileModule(ast.text, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  new Function("require", "module", "exports", code)(load, compiled, compiled.exports);
  return compiled.exports.default;
}

// Execute the actual function/effect bodies with controlled network/state IO.
function callback(file: string, name: string, scope: Record<string, unknown>) {
  const ast = parse(file); let expression = "";
  function visit(n: ts.Node) {
    if (ts.isFunctionDeclaration(n) && n.name?.text === name) expression = n.getText(ast);
    if (name === "effect" && ts.isCallExpression(n) && n.expression.getText(ast) === "useEffect") expression = n.arguments[0].getText(ast);
    ts.forEachChild(n, visit);
  }
  visit(ast); assert.ok(expression, name);
  const code = ts.transpileModule(`const run = ${expression};`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  return new Function(...Object.keys(scope), `${code}; return run;`)(...Object.values(scope));
}
const flush = async () => { for (let i = 0; i < 6; i++) await new Promise(resolve => setImmediate(resolve)); };
const badResponses = [() => Response.json({ error: caller }, { status: 403 }), () => new Response("broken"), () => Response.json({}), () => Response.json({ success: false }), () => { throw new Error(caller); }];

test("BOM examples, saved plurals, exact currency costs and caller escaping render bilingually", () => {
  for (const locale of locales) {
    const t = translator(locale), events: unknown[] = [];
    const Empty = loaded(list, { loading: false, boms: [] }, events);
    const html = renderWithPresentation(createElement(Empty), locale);
    for (const key of ["bomTitle", "exampleBom", "deskFrame", "steel", "costRollup", "recipes", "wastageTracking"] as const) assert.ok(html.includes(escape(t(key))), key);
    assert.deepEqual(events, [t("bomDocumentTitle")]);
    for (const currencyCode of ["USD", "JPY", "KWD"]) {
      const Page = loaded(list, { loading: false, boms: [{ ...bom, currencyCode }] });
      const saved = renderWithPresentation(createElement(Page), locale);
      assert.ok(saved.includes(escape(caller)) && !saved.includes("<script>"));
      assert.ok(saved.includes(escape(t("bomSummary", { item: caller, count: 1, cost: expenseMoneyDisplay(1650000004n, currencyCode, resolvePresentation({ user: { language: locale } })) }))));
      for (const key of ["inactive", "actions", "open", "delete"] as const) assert.ok(saved.includes(escape(t(key))), key);
    }
    assert.notEqual(t("bomSummary", { item: "x", count: 1, cost: "y" }), t("bomSummary", { item: "x", count: 2, cost: "y" }));
  }
});

test("BOM detail renders exact quantity, wastage, costs, empty components and absence", () => {
  for (const locale of locales) {
    const t = translator(locale), Page = loaded(detail, { loading: false, data });
    const html = renderWithPresentation(createElement(Page), locale);
    for (const key of ["costBreakdown", "overhead", "totalCost", "removeComponent"] as const) assert.ok(html.includes(escape(t(key))), key);
    assert.ok(html.includes(escape(t("quantity", { quantity: component.quantity }))));
    assert.ok(html.includes(escape(t("wastage", { percent: component.wastagePercent }))));
    assert.ok(html.includes(escape(expenseMoneyDisplay(1650000004n, "USD", resolvePresentation({ user: { language: locale } })))));
    assert.ok(html.includes(escape(caller)) && !html.includes("<script>"));
    for (const [state, key] of [[null, "notFound"], [{ ...data, bom: { ...bom, components: [] } }, "noComponents"]] as const) {
      const State = loaded(detail, { loading: false, data: state });
      assert.ok(renderWithPresentation(createElement(State), locale).includes(escape(t(key))));
    }
  }
});

test("assembly examples and all canonical statuses render translated labels and correct controls", () => {
  for (const locale of locales) {
    const t = translator(locale), Empty = loaded(orders, { loading: false, orders: [] });
    const empty = renderWithPresentation(createElement(Empty), locale);
    for (const key of ["exampleWorkflow", "deskOrder", "reserved", "finishedStock", "autoInventory", "auditTrail"] as const) assert.ok(empty.includes(escape(t(key))), key);
    for (const status of ["draft", "in_progress", "completed", "cancelled"] as const) {
      const Page = loaded(orders, { loading: false, orders: [{ ...order, status, completedAt: status === "completed" ? order.createdAt : null }] });
      const html = renderWithPresentation(createElement(Page), locale);
      assert.ok(html.includes(escape(t(status === "in_progress" ? "inProgress" : status))));
      assert.ok(html.includes(escape(t("orderName", { name: caller, quantity: 3 }))));
      assert.ok(html.includes(escape(caller)) && !html.includes("<script>"));
      const buttons = [...html.matchAll(/<button\b[\s\S]*?<\/button>/g)].map(match => match[0].replace(/<[^>]*>/g, "").trim());
      assert.equal(buttons.includes(t("start")), status === "draft");
      assert.equal(buttons.includes(t("complete")), status === "draft" || status === "in_progress");
      if (status === "completed") assert.ok(html.includes(escape(t("completedDate", { date: new Date(order.createdAt).toLocaleDateString() }))));
    }
  }
});

test("loading and read errors use actual shared/localized rendering on all three routes", () => {
  for (const locale of locales) for (const [file, key] of [[list, "bomReadFailed"], [detail, "detailReadFailed"], [orders, "assemblyReadFailed"]] as const) {
    const Page = loaded(file, { loading: false, readError: true });
    assert.ok(renderWithPresentation(createElement(Page), locale).includes(escape(translator(locale)(key))));
    const Loading = loaded(file, { loading: true });
    assert.ok(renderWithPresentation(createElement(Loading), locale).length > 0);
  }
});

test("assembly readers reject malformed envelopes, displayed fields, money and decimal alias conflicts", async () => {
  assert.equal((await readers.assemblyBomsJson(Response.json({ data: [bom] })))[0].id, bom.id);
  assert.equal((await readers.assemblyBomJson(Response.json(data))).costBreakdown.totalCostMinor, "1650000004");
  assert.equal((await readers.assemblyOrdersJson(Response.json({ data: [order] })))[0].quantity, 3);
  for (const invalid of [{ ...bom, name: {} }, { ...bom, assemblyItem: null }, { ...bom, description: 1 }, { ...bom, isActive: 1 },
    { ...bom, costBreakdown: { ...costs, totalCostMinor: "1650000003" } },
    { ...bom, components: [{ ...component, quantityExact: "0.6" }] },
    { ...bom, components: [{ ...component, componentItem: { ...item, purchasePriceMinor: "01" } }] }])
    await assert.rejects(() => readers.assemblyBomsJson(Response.json({ data: [invalid] })));
  await assert.rejects(() => readers.assemblyBomJson(Response.json({ ...data, costBreakdown: { ...costs, totalCostMinor: "2" } })));
  for (const invalid of [{ ...order, status: caller }, { ...order, quantity: 1.5 }, { ...order, quantity: 2147483648 }, { ...order, bom: null }, { ...order, completedAt: "bad" }, { ...order, status: "completed" }])
    await assert.rejects(() => readers.assemblyOrdersJson(Response.json({ data: [invalid] })));
  for (const response of [Response.json({ data: [bom] }, { status: 500 }), new Response("broken"), Response.json({ data: {} }), Response.json({ data: [bom], error: caller })])
    await assert.rejects(() => readers.assemblyBomsJson(response));
});

test("start validates header-only responses, retains nested recipe and canonical requests on success/failure", async () => {
  for (const locale of locales) for (const response of [() => Response.json({ order: { ...order, bom: undefined, status: "in_progress" } }), ...badResponses]) {
    const t = translator(locale), successes: string[] = [], errors: string[] = [], calls: unknown[] = [];
    let saved = [order];
    await callback(orders, "handleStart", { ...readers, t, getHeaders: () => ({ "x-organization-id": "org-a", "Content-Type": "application/json" }),
      fetch: async (...args: unknown[]) => { calls.push(args); return response(); },
      setOrders: (fn: (rows: typeof saved) => typeof saved) => { saved = fn(saved); }, toast: { success: (v: string) => successes.push(v), error: (v: string) => errors.push(v) } })(order.id);
    assert.deepEqual(calls, [[`/api/v1/inventory/assembly-orders/${order.id}`, { method: "PATCH", headers: { "x-organization-id": "org-a", "Content-Type": "application/json" }, body: JSON.stringify({ status: "in_progress" }) }]]);
    assert.equal(saved[0].bom, bom);
    if (successes.length) { assert.deepEqual(successes, [t("assemblyStarted")]); assert.equal(saved[0].status, "in_progress"); }
    else { assert.deepEqual(errors, [t("startFailed")]); assert.equal(saved[0], order); }
  }
  for (const patch of [{ id: "other" }, { status: "draft" }, { quantity: 0 }, { status: "completed", completedAt: null }])
    await assert.rejects(() => readers.assemblyUpdatedJson(Response.json({ order: { ...order, status: "in_progress", ...patch } }), order.id, "in_progress"));
});

test("completion confirmation localizes cancel; cancellation makes no request; failed completion preserves order", async () => {
  for (const locale of locales) for (const perform of [false, true]) for (const succeed of [false, true]) {
    const t = translator(locale), calls: unknown[] = [], successes: string[] = [], errors: string[] = [];
    let saved = [order];
    await callback(orders, "handleComplete", { ...readers, t, getHeaders: () => ({ "x-organization-id": "org-a" }),
      confirm: async (options: { title: string; description: string; cancelLabel: string; confirmLabel: string; onConfirm: () => Promise<void> }) => {
        assert.equal(options.title, t("completeTitle")); assert.equal(options.description, t("completeDescription", { quantity: 3 }));
        assert.equal(options.cancelLabel, t("cancel")); assert.equal(options.confirmLabel, t("complete")); if (perform) await options.onConfirm();
      }, fetch: async (...args: unknown[]) => { calls.push(args); return succeed ? Response.json({ order: { ...order, bom: undefined, status: "completed", completedAt: order.createdAt } }) : Response.json({ error: caller }, { status: 409 }); },
      setOrders: (fn: (rows: typeof saved) => typeof saved) => { saved = fn(saved); }, toast: { success: (v: string) => successes.push(v), error: (v: string) => errors.push(v) } })(order);
    assert.equal(calls.length, perform ? 1 : 0);
    if (perform) assert.deepEqual(calls[0], [`/api/v1/inventory/assembly-orders/${order.id}/complete`, { method: "POST", headers: { "x-organization-id": "org-a" } }]);
    assert.deepEqual(successes, perform && succeed ? [t("assemblyCompleted")] : []);
    assert.deepEqual(errors, perform && !succeed ? [t("completeFailed")] : []);
    assert.equal(saved[0].status, perform && succeed ? "completed" : "draft"); assert.equal(saved[0].bom, bom);
  }
});

test("BOM deletion verifies response before success and keeps failed/cancelled rows", async () => {
  for (const locale of locales) for (const perform of [false, true]) for (const response of [() => Response.json({ success: true }), ...badResponses]) {
    const t = translator(locale), successes: string[] = [], errors: string[] = [], calls: unknown[] = []; let saved = [bom];
    await callback(list, "handleDelete", { ...readers, t, getHeaders: () => ({ "x-organization-id": "org-a" }),
      confirm: async (options: { title: string; cancelLabel: string; destructive: boolean; onConfirm: () => Promise<void> }) => {
        assert.equal(options.title, t("deleteTitle", { name: caller })); assert.equal(options.cancelLabel, t("cancel")); assert.equal(options.destructive, true); if (perform) await options.onConfirm();
      }, fetch: async (...args: unknown[]) => { calls.push(args); return response(); },
      setBoms: (fn: (rows: typeof saved) => typeof saved) => { saved = fn(saved); }, toast: { success: (v: string) => successes.push(v), error: (v: string) => errors.push(v) } })(bom);
    assert.equal(calls.length, perform ? 1 : 0);
    if (perform) assert.deepEqual(calls[0], [`/api/v1/inventory/bom/${bom.id}`, { method: "DELETE", headers: { "x-organization-id": "org-a" } }]);
    assert.equal(saved.length, successes.length ? 0 : 1);
    assert.deepEqual(successes, successes.length ? [t("deleted")] : []);
    assert.deepEqual(errors, perform && !successes.length ? [t("deleteFailed")] : []);
  }
});

test("component removal keeps failures and reports verified removal separately from refresh failure", async () => {
  for (const locale of locales) for (const removeOk of [false, true]) for (const refreshOk of [false, true]) {
    const t = translator(locale), successes: string[] = [], errors: string[] = [], calls: unknown[] = [], state: unknown[] = [], readErrors: boolean[] = [];
    await callback(detail, "removeComponent", { ...readers, t, id: bom.id, getHeaders: () => ({ "x-organization-id": "org-a" }),
      fetch: async (...args: unknown[]) => { calls.push(args); return calls.length === 1 ? Response.json({ success: removeOk }) : refreshOk ? Response.json(data) : new Response("broken"); },
      setData: (v: unknown) => state.push(v), setReadError: (v: boolean) => readErrors.push(v), toast: { success: (v: string) => successes.push(v), error: (v: string) => errors.push(v) } })(component.id);
    assert.deepEqual(calls[0], [`/api/v1/inventory/bom/${bom.id}/components?componentId=${component.id}`, { method: "DELETE", headers: { "x-organization-id": "org-a" } }]);
    assert.equal(calls.length, removeOk ? 2 : 1);
    assert.deepEqual(successes, removeOk ? [t("removed")] : []); assert.deepEqual(errors, removeOk ? [] : [t("removeFailed")]);
    assert.deepEqual(state, removeOk ? [refreshOk ? data : null] : []); assert.deepEqual(readErrors, removeOk && !refreshOk ? [true] : []);
  }
});

test("route effects validate actual envelopes and ignore disposed reads while missing organization prevents IO", async () => {
  for (const [file, payload, path, setter, expected] of [[list, { data: [bom] }, "/api/v1/inventory/bom", "setBoms", [bom]], [detail, data, `/api/v1/inventory/bom/${bom.id}`, "setData", data], [orders, { data: [order] }, "/api/v1/inventory/assembly-orders", "setOrders", [order]]] as const) {
    for (const mode of ["ok", "disposed", "missing-org", "malformed", "network"] as const) {
      const states: unknown[] = [], loading: boolean[] = [], errors: boolean[] = [], calls: unknown[] = [];
      const scope = { ...readers, id: bom.id, setLoading: (v: boolean) => loading.push(v), setData: (v: unknown) => states.push(v), [setter]: (v: unknown) => states.push(v), setReadError: (v: boolean) => errors.push(v),
        getHeaders: callback(file, "getHeaders", { localStorage: { getItem: () => mode === "missing-org" ? null : "org-a" } }),
        fetch: async (...args: unknown[]) => { calls.push(args); if (mode === "network") throw new Error(caller); return mode === "malformed" ? new Response("broken") : Response.json(payload); } };
      const dispose = callback(file, "effect", scope)(); if (mode === "disposed") dispose();
      await flush();
      assert.equal(calls.length, mode === "missing-org" ? 0 : 1); if (calls.length) assert.equal((calls[0] as unknown[])[0], path);
      if (mode === "ok") { assert.deepEqual(states.at(-1), expected); assert.equal(loading.at(-1), false); }
      else if (mode === "disposed") { assert.equal(states.filter(v => v !== null).length, 0); assert.ok(!loading.includes(false)); assert.ok(!errors.includes(true)); }
      else { assert.equal(errors.at(-1), true); assert.equal(loading.at(-1), false); assert.equal(states.filter(v => v !== null).length, 0); }
    }
  }
});

test("paired Persian assembly messages contain script and authored JSX retains only explicit identifiers", () => {
  assert.deepEqual(Object.keys(en.InventoryAssembly), Object.keys(fa.InventoryAssembly));
  for (const [key, value] of Object.entries(fa.InventoryAssembly)) {
    if (key === "orderName") assert.equal(value, "{name} ×{quantity}"); // Caller name and physical quantity only.
    else assert.match(value, /[\u0600-\u06ff]/u, key);
  }
  for (const file of [list, detail, orders]) {
    const ast = parse(file);
    function audit(n: ts.Node) {
      if (ts.isJsxText(n) && /[A-Za-z]/.test(n.text)) assert.ok(["SKU-DESK-001", "x"].includes(n.text.trim()), `${file}: ${n.text}`);
      if (ts.isJsxAttribute(n) && ["placeholder", "title", "aria-label"].includes(n.name.getText(ast))) assert.ok(!n.initializer || !ts.isStringLiteral(n.initializer));
      ts.forEachChild(n, audit);
    }
    audit(ast);
  }
});
