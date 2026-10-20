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
import * as readers from "../i18n/inventory-report-presentation";
import * as BrandLoader from "../components/dashboard/brand-loader";
import { inventoryPercent } from "../lib/money/inventory-ui";
import { money, toMajorDecimal } from "../lib/money/exact";
import { renderWithPresentation } from "./helpers/presentation";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";

const valuation = "app/(dashboard)/inventory/valuation/page.tsx";
const alerts = "app/(dashboard)/inventory/alerts/page.tsx";
const locales = ["en-US", "fa-IR"] as const;
const noop = () => {};
const caller = '<script>caller & "stock"</script>';
const item = { id: "item-a", name: caller, code: 'CODE,"A"', category: caller, quantityOnHand: 3,
  unitCost: 3000000001, unitCostMinor: "3000000001", salePrice: 3000000002, salePriceMinor: "3000000002",
  totalCost: 9000000003, totalCostMinor: "9000000003", totalValue: 9000000006, totalValueMinor: "9000000006",
  carryingValue: 9000000001, carryingValueMinor: "9000000001", averageCost: 3000000000, averageCostMinor: "3000000000",
  margin: 3, marginMinor: "3", marginPercent: 0.0000000333, currencyCode: "USD" };
const summary = { totalItems: 1, totalCost: item.totalCost, totalCostMinor: item.totalCostMinor,
  totalValue: item.totalValue, totalValueMinor: item.totalValueMinor, carryingValue: item.carryingValue,
  carryingValueMinor: item.carryingValueMinor, totalMargin: item.marginPercent, currencyCode: "USD" };
const supplier = { contactId: "supplier-a", contactName: caller, isPreferred: true };
const suggestion = { id: item.id, code: item.code, name: caller, sku: caller, quantityOnHand: 0,
  reorderPoint: 10, suggestedReorderQuantity: 20, suppliers: [supplier] };
const escape = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#x27;");
function translator(locale: typeof locales[number]) { return createTranslator({ locale, messages: locale === "en-US" ? en : fa, namespace: "InventoryReports" }); }
function parse(file: string) { return ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX); }

// Production JSX and next-intl, with controlled hooks/IO and no mounted-browser claim.
function loaded(file: string, states: Record<string, unknown>, events: unknown[] = []) {
  const ast = parse(file), names: string[] = [];
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
    if (id === "next/navigation") return { useRouter: () => ({ push: noop }) };
    if (id.endsWith("/use-document-title")) return { useDocumentTitle: (value: string) => events.push(value) };
    if (id.endsWith("/brand-loader")) return BrandLoader;
    if (id.endsWith("/create-drawer")) return { useCreateDrawer: () => ({ open: noop }) };
    if (id.endsWith("/page-header")) return { PageHeader: ({ title, description, children }: { title: string; description: string; children: ReactNode }) => createElement("header", null, title, description, children) };
    return require(id.startsWith("@/") ? resolve(id.slice(2)) : id);
  };
  const code = ts.transpileModule(ast.text, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  new Function("require", "module", "exports", code)(load, compiled, compiled.exports);
  return compiled.exports.default;
}
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

test("valuation examples, all columns, exact money and filtered absence render in both locales", () => {
  for (const locale of locales) {
    const t = translator(locale), events: unknown[] = [];
    const Empty = loaded(valuation, { loading: false }, events);
    const html = renderWithPresentation(createElement(Empty), locale);
    for (const key of ["valuationTitle", "valuationDescription", "preview", "sampleWidget", "sampleGadget", "sampleCable", "previewHelp", "addItem"] as const) assert.ok(html.includes(escape(t(key))), key);
    assert.deepEqual(events, [t("valuationDocumentTitle")]);
    for (const currencyCode of ["USD", "JPY", "KWD"]) {
      const Page = loaded(valuation, { loading: false, items: [{ ...item, currencyCode }], summary: { ...summary, currencyCode } });
      const saved = renderWithPresentation(createElement(Page), locale);
      assert.ok(saved.includes(escape(caller)) && !saved.includes("<script>"));
      assert.ok(saved.includes(`${currencyCode} ${toMajorDecimal(money(BigInt(item.carryingValueMinor), currencyCode))}`));
      for (const key of ["code", "name", "category", "quantityOnHand", "unitCost", "totalCost", "carryingValue", "salePrice", "totalValue", "marginPercent", "search", "costAmount", "profitAmount"] as const)
        assert.ok(saved.includes(escape(key === "costAmount" || key === "profitAmount" ? t(key, { amount: `${currencyCode} ${toMajorDecimal(money(key === "costAmount" ? BigInt(item.totalCostMinor) : 3n, currencyCode))}` }) : t(key))), key);
    }
    for (const searchQuery of ["CALLER", "code", "no match"]) {
      const Page = loaded(valuation, { loading: false, items: [item], summary, searchQuery });
      const saved = renderWithPresentation(createElement(Page), locale);
      assert.equal(saved.includes(escape(t("noMatches"))), searchQuery === "no match");
    }
  }
});

test("alerts render canonical suggestions, preferred supplier, critical and low stock and empty state", async () => {
  for (const locale of locales) {
    const t = translator(locale), events: unknown[] = [];
    const items = await readers.inventoryAlertsJson(Response.json({ data: [suggestion, { ...suggestion, id: "low", quantityOnHand: 3, suggestedReorderQuantity: 17, sku: null, suppliers: [] }] }));
    const Page = loaded(alerts, { loading: false, items }, events), html = renderWithPresentation(createElement(Page), locale);
    for (const key of ["totalAlerts", "outOfStock", "belowReorder", "suggested", "createPo"] as const) assert.ok(html.includes(escape(t(key))), key);
    assert.ok(html.includes(escape(t("alertSummary", { code: suggestion.code, sku: ` · ${caller}`, quantity: 0, point: 10 }))));
    assert.ok(html.includes("+20") && html.includes("+17") && html.includes(escape(caller)) && !html.includes("<script>"));
    assert.deepEqual(events, [t("alertsDocumentTitle")]);
    const Empty = loaded(alerts, { loading: false });
    const empty = renderWithPresentation(createElement(Empty), locale);
    assert.ok(empty.includes(escape(t("noAlerts"))) && empty.includes(escape(t("noAlertsDescription"))));
  }
});

test("valuation margin sorting preserves ratios below Number precision in both directions", () => {
  for (const locale of locales) for (const sortOrder of ["asc", "desc"]) {
    const higher = { ...item, id: "higher", name: "Higher ratio", margin: 9007199254740990, marginMinor: "9007199254740990", totalCost: 9007199254740991, totalCostMinor: "9007199254740991" };
    const lower = { ...item, id: "lower", name: "Lower ratio", margin: 9007199254740989, marginMinor: "9007199254740989", totalCost: 9007199254740990, totalCostMinor: "9007199254740990" };
    const Page = loaded(valuation, { loading: false, items: [higher, lower], summary, sortKey: "marginPercent", sortOrder });
    const html = renderWithPresentation(createElement(Page), locale);
    assert.equal(html.indexOf("Higher ratio") < html.indexOf("Lower ratio"), sortOrder === "desc");
  }
});

test("loading surfaces and finite read errors render with the real shared loader", () => {
  for (const locale of locales) for (const [file, key] of [[valuation, "valuationReadFailed"], [alerts, "alertsReadFailed"]] as const) {
    const ErrorPage = loaded(file, { loading: false, readError: true });
    assert.ok(renderWithPresentation(createElement(ErrorPage), locale).includes(escape(translator(locale)(key))));
    const Loading = loaded(file, { loading: true });
    assert.ok(renderWithPresentation(createElement(Loading), locale).includes(escape((locale === "en-US" ? en : fa).SharedUI.loading2)));
  }
  const require = createRequire(resolve("app/(dashboard)/inventory/loading.tsx"));
  const source = readFileSync("app/(dashboard)/inventory/loading.tsx", "utf8"), compiled = { exports: {} as { default: ComponentType } };
  new Function("require", "module", "exports", ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText)((id: string) => id.endsWith("/brand-loader") ? BrandLoader : require(id), compiled, compiled.exports);
  for (const locale of locales) assert.ok(renderWithPresentation(createElement(compiled.exports.default), locale).includes(escape((locale === "en-US" ? en : fa).SharedUI.loading2)));
});

test("readers reject failed HTTP, malformed display fields and exact-money conflicts", async () => {
  assert.deepEqual(await readers.inventoryValuationJson(Response.json({ items: [item], summary })), { items: [item], summary });
  for (const invalid of [{ ...item, name: {} }, { ...item, category: 1 }, { ...item, unitCostMinor: "01" }, { ...item, totalCostMinor: "1" }, { ...item, currencyCode: "JPY" }])
    await assert.rejects(() => readers.inventoryValuationJson(Response.json({ items: [invalid], summary })));
  await assert.rejects(() => readers.inventoryValuationJson(Response.json({ items: [item], summary: { ...summary, totalCostMinor: "1" } })));
  for (const read of [readers.inventoryValuationJson, readers.inventoryAlertsJson]) for (const response of [new Response("broken"), Response.json({}), Response.json({ data: [], items: [], summary }, { status: 403 }), Response.json({ error: caller, data: [], items: [], summary })]) await assert.rejects(() => read(response));
});

test("reorder reader preserves zero/negative stock and suggestions above int32, with finite supplier mapping", async () => {
  for (const [quantityOnHand, reorderPoint] of [[0, 0], [-2147483648, 2147483647], [1, 2147483647]]) {
    const row = { ...suggestion, quantityOnHand, reorderPoint, suggestedReorderQuantity: reorderPoint * 2 - quantityOnHand };
    const parsed = (await readers.inventoryAlertsJson(Response.json({ data: [row] })))[0];
    assert.equal(parsed.suggestedReorderQuantity, row.suggestedReorderQuantity);
    assert.deepEqual(parsed.preferredSupplier, { contactId: supplier.contactId, contactName: caller });
  }
  const parsed = await readers.inventoryAlertsJson(Response.json({ data: [{ ...suggestion, suppliers: [{ ...supplier, isPreferred: false }] }] }));
  assert.equal(parsed[0].preferredSupplier, null);
  for (const patch of [{ name: {} }, { sku: 1 }, { quantityOnHand: 0.5 }, { reorderPoint: -1 }, { quantityOnHand: 11 }, { suggestedReorderQuantity: 19 }, { suppliers: null }, { suppliers: [{ ...supplier, contactName: {} }] }])
    await assert.rejects(() => readers.inventoryAlertsJson(Response.json({ data: [{ ...suggestion, ...patch }] })));
});

test("read effects preserve paths/headers and suppress disposed reads; all failures end loading without adopting data", async () => {
  for (const [file, payload, path] of [[valuation, { items: [item], summary }, "/api/v1/reports/inventory-valuation"], [alerts, { data: [suggestion] }, "/api/v1/inventory/reorder-suggestions"]] as const) {
    for (const mode of ["ok", "disposed", "missing-org", "malformed", "network", "http"] as const) {
      const items: unknown[] = [], summaries: unknown[] = [], loading: boolean[] = [], errors: boolean[] = [], calls: unknown[] = [];
      const dispose = callback(file, "effect", { ...readers, orgId: mode === "missing-org" ? null : "org-a", setItems: (value: unknown) => items.push(value), setSummary: (value: unknown) => summaries.push(value), setLoading: (value: boolean) => loading.push(value), setReadError: (value: boolean) => errors.push(value),
        fetch: async (...args: unknown[]) => { calls.push(args); if (mode === "network") throw new Error(caller); return mode === "malformed" ? new Response("broken") : Response.json(payload, { status: mode === "http" ? 403 : 200 }); } })();
      if (mode === "disposed") dispose(); await flush();
      assert.deepEqual(calls, mode === "missing-org" ? [] : [[path, { headers: { "x-organization-id": "org-a" } }]]);
      assert.equal(items.length, mode === "ok" ? 1 : 0);
      if (mode === "ok") { assert.deepEqual(items[0], file === valuation ? [item] : await readers.inventoryAlertsJson(Response.json(payload))); assert.equal(loading.at(-1), false); assert.equal(errors.at(-1), false); }
      else if (mode === "disposed") { assert.ok(!loading.includes(false) && !errors.includes(true)); }
      else { assert.equal(loading.at(-1), false); assert.equal(errors.at(-1), true); assert.equal(summaries.length, 0); }
    }
  }
});

test("CSV remains byte-identical across locales including canonical headers, quoting, money and UTC filename", async () => {
  const exports: string[] = [];
  for (const locale of locales) {
    const successes: string[] = [], anchor = { href: "", download: "", click: noop }; let blob: Blob | undefined;
    callback(valuation, "exportCsv", { sortedItems: [item], money, toMajorDecimal, inventoryPercent, Blob, Date,
      URL: { createObjectURL: (value: Blob) => { blob = value; return "blob:csv"; }, revokeObjectURL: (value: string) => assert.equal(value, "blob:csv") },
      document: { createElement: (tag: string) => { assert.equal(tag, "a"); return anchor; } }, t: translator(locale), toast: { success: (value: string) => successes.push(value) } })();
    assert.ok(blob); const csv = await blob.text(); exports.push(csv);
    assert.equal(csv.split("\n")[0], '"Code","Name","Category","Qty On Hand","Unit Cost","Purchase Price Value","Book Value","Currency","Sale Price","Total Value","Margin %"');
    assert.ok(csv.includes('"CODE,""A"""') && csv.includes('"30000000.01"') && csv.includes('"90000000.01"'));
    assert.equal(anchor.download, `inventory-valuation-${new Date().toISOString().slice(0, 10)}.csv`);
    assert.deepEqual(successes, [translator(locale)("csvExported")]);
  }
  assert.equal(exports[0], exports[1]);
});

test("Persian report keys contain script and all authored display is catalog-owned", () => {
  assert.deepEqual(Object.keys(en.InventoryReports), Object.keys(fa.InventoryReports));
  for (const [key, value] of Object.entries(fa.InventoryReports)) assert.match(value, /[\u0600-\u06ff]/u, key);
  for (const file of [valuation, alerts]) {
    const ast = parse(file);
    function audit(n: ts.Node) {
      if (ts.isJsxText(n)) assert.doesNotMatch(n.text, /[A-Za-z]/, `${file}: ${n.text}`);
      if (ts.isJsxAttribute(n) && ["title", "description", "placeholder", "aria-label"].includes(n.name.getText(ast))) assert.ok(!n.initializer || !ts.isStringLiteral(n.initializer));
      ts.forEachChild(n, audit);
    }
    audit(ast);
  }
});
