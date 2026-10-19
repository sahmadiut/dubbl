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
import { landedCostStatusLabel, landedCostMethodLabel } from "../i18n/landed-cost-presentation";
import { catalogPriceMinor } from "../lib/money/catalog-input";
import { renderWithPresentation } from "./helpers/presentation";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";

const list = "app/(dashboard)/purchases/landed-costs/page.tsx";
const detail = "app/(dashboard)/purchases/landed-costs/[id]/page.tsx";
const locales = ["en-US", "fa-IR"] as const;
const noop = () => {};
const caller = "<script>freight & duty</script>";
const raw = {
  id: "batch-a", name: caller, allocationMethod: "by_value", totalCostAmount: 9007199254740991,
  currencyCode: "USD", status: "draft", createdAt: "2026-10-19T00:00:00Z", allocatedAt: null,
  purchaseOrder: { poNumber: "PO-0042" }, bill: { billNumber: "B-0042" },
  components: [{ id: "component-a", description: caller, amount: 1250, accountId: "account-a" }],
  lineAllocations: [{ id: "allocation-a", componentId: "component-a", purchaseOrderLineId: "po-line-a", allocatedAmount: 1250, allocationBasis: 125 }],
};
const components = [{ description: caller, amount: "12.50", accountId: "" }];
function translator(locale: typeof locales[number]) { return createTranslator({ locale, messages: locale === "en-US" ? en : fa, namespace: "LandedCosts" }); }
function escape(value: string) { return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#x27;"); }
function parse(path: string) { return ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX); }

// Production components and next-intl render with controlled state/navigation.
// Portals are inlined to inspect the creation fields and option values.
function loaded(path: string, states: Record<string, unknown> = {}) {
  const ast = parse(path), names: string[] = [];
  function visit(n: ts.Node) {
    if (ts.isVariableDeclaration(n) && ts.isArrayBindingPattern(n.name) && n.initializer && ts.isCallExpression(n.initializer) && n.initializer.expression.getText(ast) === "useState") names.push(n.name.elements[0].getText(ast));
    ts.forEachChild(n, visit);
  }
  visit(ast);
  const require = createRequire(resolve(path)), compiled = { exports: {} as { default: ComponentType } };
  let index = 0;
  const inline = ({ children }: { children: ReactNode }) => createElement("div", null, children);
  const load = (id: string) => {
    if (id === "react") return { ...React, useState: (initial: unknown) => { const key = names[index++]; return [Object.hasOwn(states, key) ? states[key] : initial, noop]; }, useEffect: noop, useCallback: (fn: unknown) => fn };
    if (id === "next-intl") return nextIntl;
    if (id === "next/navigation") return { useParams: () => ({ id: raw.id }), useRouter: () => ({ push: noop }) };
    if (id.endsWith("/use-document-title")) return { useDocumentTitle: noop };
    if (id.endsWith("/ui/sheet")) return Object.fromEntries(["Sheet", "SheetContent", "SheetHeader", "SheetTitle"].map(key => [key, inline]));
    if (id.endsWith("/ui/select")) return { Select: inline, SelectTrigger: inline, SelectContent: inline, SelectValue: () => null, SelectItem: ({ children, value }: { children: ReactNode; value: string }) => createElement("div", { "data-option": value }, children) };
    return require(id.startsWith("@/") ? resolve(id.slice(2)) : id);
  };
  const code = ts.transpileModule(ast.text, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  new Function("require", "module", "exports", code)(load, compiled, compiled.exports);
  return compiled.exports.default;
}

function callback(path: string, name: string, scope: Record<string, unknown>) {
  const ast = parse(path); let expression = "";
  function visit(n: ts.Node) {
    if (ts.isFunctionDeclaration(n) && n.name?.text === name) expression = n.getText(ast);
    if (ts.isVariableDeclaration(n) && n.name.getText(ast) === name && n.initializer && ts.isCallExpression(n.initializer)) expression = n.initializer.arguments[0].getText(ast);
    ts.forEachChild(n, visit);
  }
  visit(ast); assert.ok(expression, name);
  const code = ts.transpileModule(`const run = ${expression};`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  return new Function(...Object.keys(scope), `${code}; return run;`)(...Object.values(scope));
}
const flush = async () => { for (let i = 0; i < 6; i++) await new Promise(resolve => setImmediate(resolve)); };

test("landed cost list, creation and detail render bilingual copy and exact saved amounts", () => {
  for (const locale of locales) {
    const t = translator(locale);
    const List = loaded(list, { loading: false, items: [raw], sheetOpen: true, components: [...components, ...components] });
    const html = renderWithPresentation(createElement(List), locale);
    for (const key of ["title", "description", "newAllocation", "name", "source", "method", "totalCost", "status", "date", "actions", "draft", "allocate", "requiredName", "purchaseOrderId", "billId", "allocationMethod", "byValue", "byQuantity", "requiredComponents", "add", "requiredDescription", "requiredAmount", "accountId", "cancel", "create", "namePlaceholder", "descriptionPlaceholder"] as const) assert.ok(html.includes(escape(t(key))), key);
    assert.ok(html.includes(`aria-label="${escape(t("delete"))}"`));
    assert.ok(html.includes(`aria-label="${escape(t("removeComponent", { number: 2 }))}"`));
    for (const method of ["by_value", "by_quantity"]) assert.ok(html.includes(`data-option="${method}"`));
    assert.ok(html.includes("USD 90071992547409.91") && html.includes(escape(caller)) && !html.includes("<script>"));
    const Empty = loaded(list, { loading: false, readError: true });
    const empty = renderWithPresentation(createElement(Empty), locale);
    assert.ok(empty.includes(escape(t("empty"))) && empty.includes(escape(t("readFailed"))));
    const Saving = loaded(list, { loading: false, saving: true }); assert.ok(renderWithPresentation(createElement(Saving), locale).includes(escape(t("creating"))));
    for (const path of [list, detail]) assert.ok(renderWithPresentation(createElement(loaded(path)), locale).includes(escape(t("loading"))));
    for (const status of ["draft", "allocated", "__proto__"]) {
      const Page = loaded(detail, { loading: false, item: { ...raw, status } });
      const result = renderWithPresentation(createElement(Page), locale);
      for (const key of ["totalCost", "components", "method", "costComponents", "componentDescription", "amount", "account"] as const) assert.ok(result.includes(escape(t(key))), key);
      assert.ok(result.includes(escape(landedCostStatusLabel(t, status))) && result.includes("USD 12.50") && result.includes(escape(caller)));
      assert.ok(result.includes(escape(t("poReference", { number: "PO-0042" }))) && result.includes(escape(t("billReference", { number: "B-0042" }))));
      if (status === "allocated") for (const key of ["results", "poLineId", "componentId", "basis", "allocatedAmount"] as const) assert.ok(result.includes(escape(t(key))), key);
    }
    for (const readError of [false, true]) assert.ok(renderWithPresentation(createElement(loaded(detail, { loading: false, readError })), locale).includes(escape(t(readError ? "readFailed" : "notFound"))));
    const NoSource = loaded(detail, { loading: false, item: { ...raw, purchaseOrder: null, bill: null } }); assert.ok(renderWithPresentation(createElement(NoSource), locale).includes(escape(t("noSource"))));
  }
});

test("creation preserves exact minor payload and failed forms across parser, request and response failures", async () => {
  for (const locale of locales) for (const mode of ["success", "denied", "network", "json", "shape", "emptyId", "parser", "range", "name", "component", "busy"]) {
    const t = translator(locale), errors: string[] = [], successes: string[] = [], busy: boolean[] = [];
    let requests = 0, resets = 0, closes = 0, reloads = 0;
    await callback(list, "handleCreate", {
      t, saving: mode === "busy", name: mode === "name" ? " " : caller, purchaseOrderId: "po-a", billId: "", allocationMethod: "by_quantity",
      components: [{ ...components[0], amount: mode === "parser" ? "1.001" : mode === "range" ? "90071992547409.92" : "12.50", description: mode === "component" ? " " : caller }],
      catalogPriceMinor, orgId: "org-a", setSaving: (v: boolean) => busy.push(v), setSheetOpen: () => closes++, resetForm: () => resets++, fetchItems: () => reloads++,
      toast: { error: (v: string) => errors.push(v), success: (v: string) => successes.push(v) },
      fetch: async (url: string, init: RequestInit) => {
        requests++; assert.equal(url, "/api/v1/landed-costs"); assert.equal(init.method, "POST"); assert.equal((init.headers as Record<string, string>)["x-organization-id"], "org-a");
        assert.deepEqual(JSON.parse(String(init.body)), { name: caller, purchaseOrderId: "po-a", billId: null, allocationMethod: "by_quantity", components: [{ description: caller, amountMinor: "1250", accountId: null }] });
        if (mode === "network") throw new Error("private network details"); if (mode === "json") return new Response("private HTML");
        return Response.json(mode === "shape" ? null : { allocation: { id: mode === "emptyId" ? " " : raw.id }, error: "private server prose" }, { status: mode === "denied" ? 403 : 201 });
      },
    })({ preventDefault: noop });
    assert.equal(requests, ["busy", "name", "component", "parser", "range"].includes(mode) ? 0 : 1);
    assert.equal(resets, mode === "success" ? 1 : 0); assert.equal(closes, resets); assert.equal(reloads, resets);
    assert.deepEqual(successes, mode === "success" ? [t("created")] : []);
    assert.deepEqual(errors, mode === "success" || mode === "busy" ? [] : [t(mode === "name" ? "nameRequired" : mode === "component" ? "componentsRequired" : "createFailed")]);
    assert.deepEqual(busy, ["busy", "name", "component"].includes(mode) ? [] : [true, false]);
  }
});

test("allocation and deletion preserve routes, headers and bodyless operations with localized failures", async () => {
  for (const locale of locales) for (const path of [list, detail]) for (const operation of path === list ? ["allocate", "delete"] : ["allocate"]) for (const mode of ["success", "denied", "network", "json", "shape", "wrongId", "wrongStatus"]) {
    const t = translator(locale), errors: string[] = [], successes: string[] = []; let reloads = 0;
    await callback(path, operation === "allocate" ? "handleAllocate" : "handleDelete", {
      t, id: raw.id, orgId: "org-a", fetchItems: () => reloads++, loadItem: () => reloads++,
      toast: { error: (v: string) => errors.push(v), success: (v: string) => successes.push(v) },
      fetch: async (url: string, init: RequestInit) => {
        assert.equal(url, `/api/v1/landed-costs/${raw.id}${operation === "allocate" ? "/allocate" : ""}`); assert.equal(init.method, operation === "allocate" ? "POST" : "DELETE"); assert.equal(init.body, undefined); assert.deepEqual(init.headers, { "x-organization-id": "org-a" });
        if (mode === "network") throw new Error("private"); if (mode === "json") return new Response("private");
        return Response.json(mode === "shape" ? null : { allocation: { id: mode === "wrongId" ? "other" : raw.id, status: mode === "wrongStatus" ? "draft" : "allocated" }, success: mode === "success", error: "private" }, { status: mode === "denied" ? 403 : 200 });
      },
    })(raw.id);
    assert.equal(reloads, mode === "success" ? 1 : 0);
    assert.deepEqual(successes, mode === "success" ? [t(operation === "allocate" ? "allocatedSuccess" : "deleted")] : []);
    assert.deepEqual(errors, mode === "success" ? [] : [t(operation === "allocate" ? "allocateFailed" : "deleteFailed")]);
  }
});

test("reads check HTTP, JSON and envelopes, retain existing state on failure and stop loading", async () => {
  for (const path of [list, detail]) for (const mode of ["success", "denied", "network", "json", "shape", "noOrg"]) {
    const rows: unknown[] = [], errors: boolean[] = [], busy: boolean[] = []; let requests = 0;
    callback(path, path === list ? "fetchItems" : "loadItem", {
      id: raw.id, orgId: mode === "noOrg" ? "" : "org-a", setItems: (v: unknown) => rows.push(v), setItem: (v: unknown) => rows.push(v), setReadError: (v: boolean) => errors.push(v), setLoading: (v: boolean) => busy.push(v),
      fetch: async (url: string, init: RequestInit) => {
        requests++; assert.equal(url, `/api/v1/landed-costs${path === detail ? `/${raw.id}` : ""}`); assert.deepEqual(init.headers, { "x-organization-id": "org-a" });
        if (mode === "network") throw new Error("private"); if (mode === "json") return new Response("private HTML");
        return Response.json(mode === "shape" ? null : path === list ? { data: [raw] } : raw, { status: mode === "denied" ? 403 : 200 });
      },
    })();
    await flush();
    assert.equal(requests, mode === "noOrg" ? 0 : 1); assert.deepEqual(busy, [false]);
    assert.deepEqual(rows, mode === "success" ? [path === list ? [raw] : raw] : []);
    assert.deepEqual(errors, mode === "noOrg" ? [] : [mode !== "success"]);
  }
});

test("component editing and reset retain at least one row and original defaults", () => {
  let rows = [...components];
  const setComponents = (update: ((v: typeof components) => typeof components) | typeof components) => { rows = typeof update === "function" ? update(rows) : update; };
  callback(list, "removeComponent", { components: rows, setComponents })(0); assert.equal(rows.length, 1);
  callback(list, "addComponent", { setComponents })(); assert.equal(rows.length, 2);
  callback(list, "updateComponent", { setComponents })(1, { description: caller, amount: "0.01" }); assert.equal(rows[1].amount, "0.01");
  callback(list, "removeComponent", { components: rows, setComponents })(0); assert.equal(rows.length, 1); assert.equal(rows[0].amount, "0.01");
  const defaults: Record<string, unknown> = {};
  callback(list, "resetForm", { setComponents, ...Object.fromEntries(["Name", "PurchaseOrderId", "BillId", "AllocationMethod"].map(key => [`set${key}`, (value: unknown) => { defaults[key] = value; }])) })();
  assert.deepEqual(defaults, { Name: "", PurchaseOrderId: "", BillId: "", AllocationMethod: "by_value" }); assert.deepEqual(rows, [{ description: "", amount: "", accountId: "" }]);
});

test("catalogs cover authored copy, Persian script and finite safe status/method mappings", () => {
  assert.deepEqual(Object.keys(en.LandedCosts), Object.keys(fa.LandedCosts));
  for (const value of Object.values(fa.LandedCosts)) assert.match(value, /[\u0600-\u06ff]/);
  for (const locale of locales) {
    const t = translator(locale);
    for (const code of ["draft", "allocated"] as const) assert.equal(landedCostStatusLabel(t, code), t(code));
    assert.equal(landedCostMethodLabel(t, "by_value"), t("byValue")); assert.equal(landedCostMethodLabel(t, "by_quantity"), t("byQuantity"));
    for (const code of ["toString", "constructor", "__proto__", caller]) { assert.equal(landedCostStatusLabel(t, code), code); assert.equal(landedCostMethodLabel(t, code), code); }
  }
  for (const path of [list, detail]) {
    const ast = parse(path), problems: string[] = [];
    function visit(n: ts.Node) {
      if (ts.isJsxText(n) && /[a-z]/i.test(n.text.trim())) problems.push(n.text.trim());
      if (ts.isJsxAttribute(n) && ["title", "placeholder", "aria-label"].includes(n.name.getText(ast)) && n.initializer && ts.isStringLiteral(n.initializer) && /[a-z]/i.test(n.initializer.text)) problems.push(n.getText(ast));
      ts.forEachChild(n, visit);
    }
    visit(ast); assert.deepEqual(problems, [], path);
  }
});
