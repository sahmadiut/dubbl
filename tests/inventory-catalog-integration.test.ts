import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { test } from "node:test";
import * as React from "react";
import { createElement, type FunctionComponent, type ReactNode } from "react";
import * as nextIntl from "next-intl";
import ts from "typescript";
import * as BrandLoader from "../components/dashboard/brand-loader";
import { renderWithPresentation } from "./helpers/presentation";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";

const root = "app/(dashboard)/inventory";
const drawer = "components/dashboard/create-drawer.tsx";
const pickers = ["category-picker", "warehouse-picker", "inventory-item-picker"].map(n => `components/dashboard/${n}.tsx`);
const drawerNames = ["InventoryDrawer", "CategoryDrawer", "WarehouseDrawer", "StockTakeDrawer", "TransferDrawer"] as const;
const namespaces = ["InventoryNavigation", "InventoryCategories", "InventoryItems", "InventoryCatalogs", "Warehouses", "InventoryMovements", "InventoryAssembly", "InventoryReports"] as const;
const noop = () => {};
const caller = "<script>Caller & stock</script>";
const escaped = (s: string) => s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#x27;");
const item = { id: "item-a", code: "CODE-A", name: caller, description: caller, category: caller, categoryId: "cat-a", sku: "SKU-A", imageUrl: null, purchasePrice: 4000000000000001, purchasePriceMinor: "4000000000000001", salePrice: 4000000000000003, salePriceMinor: "4000000000000003", quantityOnHand: 1, reorderPoint: 0, totalValue: 4000000000000001, totalValueMinor: "4000000000000001", priceValue: 4000000000000001, priceValueMinor: "4000000000000001", isActive: true };
type States = Record<string, Record<string, unknown>>;
type Captured = { file: string; kind: string; props: Record<string, unknown> };

// Compile linked production modules into one cache: the item context and the
// three shared pickers remain real. Hooks, navigation, IO and portals are
// controlled; this is composition verification, not a mounted browser.
function composition(pathname: string, states: States = {}, captured: Captured[] = []) {
  const cache = new Map<string, { exports: Record<string, FunctionComponent<Record<string, unknown>>> }>();
  function loadModule(file: string) {
    const path = resolve(file);
    if (cache.has(path)) return cache.get(path)!.exports;
    const ast = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    let source = ast.text;
    if (path === resolve(drawer)) {
      const names = new Set<string>([...drawerNames, "DrawerFooter", "DrawerIcon", "SectionLabel"]);
      const functions = ast.statements.filter(n => ts.isFunctionDeclaration(n) && n.name && names.has(n.name.text));
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
      }).join("\n") + `\nexport { ${drawerNames.join(", ")} };`;
    }
    const parsed = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const hooks: string[] = [];
    function inspect(n: ts.Node) {
      if (ts.isVariableDeclaration(n) && ts.isArrayBindingPattern(n.name) && n.initializer && ts.isCallExpression(n.initializer) && n.initializer.expression.getText(parsed) === "useState") hooks.push(n.name.elements[0].getText(parsed));
      ts.forEachChild(n, inspect);
    }
    inspect(parsed);
    // Drawer functions each start their own hook sequence.
    const drawerHooks = new Map<string, string[]>();
    if (path === resolve(drawer)) for (const n of parsed.statements) if (ts.isFunctionDeclaration(n) && n.name && drawerNames.includes(n.name.text as typeof drawerNames[number])) {
      hooks.length = 0; inspect(n); drawerHooks.set(n.name.text, [...hooks]);
    }
    let index = 0, activeHooks = hooks;
    const overrides = states[file] ?? {};
    const inline = (kind: string) => function Inline({ children, ...props }: { children?: ReactNode; [key: string]: unknown }) {
      captured.push({ file, kind, props });
      return createElement("div", null, children, typeof props.placeholder === "string" ? createElement("span", null, props.placeholder) : null);
    };
    const require = createRequire(path);
    const compiled = { exports: {} as Record<string, FunctionComponent<Record<string, unknown>>> };
    cache.set(path, compiled);
    const load = (id: string): unknown => {
      if (id === "react") return { ...React, useState: (initial: unknown) => {
        const key = activeHooks[index++];
        return [Object.hasOwn(overrides, key) ? overrides[key] : typeof initial === "function" ? initial() : initial, noop];
      }, useEffect: noop, useCallback: (fn: unknown) => fn, useRef: (value: unknown) => ({ current: value }) };
      if (id === "next-intl") return nextIntl;
      if (id === "next/navigation") return { useParams: () => ({ id: item.id }), usePathname: () => pathname, useRouter: () => ({ push: noop }) };
      if (id.endsWith("/use-document-title")) return { useDocumentTitle: noop };
      if (id.endsWith("/use-entity-title")) return { setEntityTitle: noop };
      if (id.endsWith("/use-confirm")) return { useConfirm: () => ({ confirm: noop, dialog: null }) };
      if (id.endsWith("/use-debounce")) return { useDebounce: (value: unknown) => value };
      if (id.endsWith("/brand-loader")) return BrandLoader;
      if (id.endsWith("/create-drawer")) return { useCreateDrawer: () => ({ open: noop }) };
      if (["/ui/sheet", "/ui/popover", "/ui/command", "/ui/select"].some(s => id.endsWith(s))) return new Proxy({}, { get: (_, key) => inline(String(key)) });
      if (id === "./layout") return loadModule(`${root}/[id]/layout.tsx`);
      if (id.startsWith("@/") && [...pickers, "components/dashboard/tab-layout.tsx"].some(p => resolve(p) === resolve(id.slice(2) + ".tsx"))) return loadModule(id.slice(2) + ".tsx");
      return require(id.startsWith("@/") ? resolve(id.slice(2)) : id.startsWith(".") ? resolve(dirname(path), id) : id);
    };
    const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
    new Function("require", "module", "exports", "window", "localStorage", code)(load, compiled, compiled.exports, {}, { getItem: () => "org-a" });
    for (const [name, keys] of drawerHooks) {
      const Original = compiled.exports[name];
      compiled.exports[name] = (props: Record<string, unknown>) => { index = 0; activeHooks = keys; return Original(props); };
    }
    return compiled.exports;
  }
  return { load: loadModule };
}

test("combined inventory namespace inventory pairs 682 messages with explicit Persian exceptions", () => {
  let count = 0;
  for (const namespace of namespaces) {
    assert.deepEqual(Object.keys(en[namespace]), Object.keys(fa[namespace]));
    count += Object.keys(en[namespace]).length;
    for (const [key, value] of Object.entries(fa[namespace])) {
      if (namespace === "InventoryAssembly" && key === "orderName" || namespace === "InventoryMovements" && key === "statusCount") continue;
      assert.match(value, /[\u0600-\u06ff]/u, `${namespace}.${key}`);
    }
  }
  assert.equal(count, 682);
});

test("item workspace composes its real context, details and category picker in both locales", () => {
  for (const locale of ["en-US", "fa-IR"] as const) {
    const messages = locale === "en-US" ? en : fa;
    const { load } = composition(`/inventory/${item.id}`, {
      [`${root}/[id]/layout.tsx`]: { item, loading: false },
      [pickers[0]]: { open: true, categories: [{ id: item.categoryId, name: caller, color: "#10b981", parentId: null, description: null }] },
    });
    const Layout = load(`${root}/layout.tsx`).default;
    const Workspace = load(`${root}/[id]/layout.tsx`).default;
    const Details = load(`${root}/[id]/page.tsx`).default;
    const html = renderWithPresentation(createElement(Layout, null, createElement(Workspace, null, createElement(Details))), locale);
    for (const key of ["details", "history", "suppliers", "variants"] as const) assert.ok(html.includes(escaped(messages.InventoryItems[key])), key);
    assert.ok(html.includes(escaped(caller)) && !html.includes("<script>"));
    assert.ok(html.includes('value="40000000000000.01"') && html.includes('value="40000000000000.03"'));
    assert.ok(html.includes("40,000,000,000,000.01"));
    assert.ok(!html.includes("MISSING_MESSAGE") && !html.includes('href="/inventory/valuation"'));
  }
});

test("transfer drawer composes real item and warehouse pickers, keeping IDs and pending footer", () => {
  for (const locale of ["en-US", "fa-IR"] as const) for (const saving of [false, true]) {
    const messages = locale === "en-US" ? en : fa, captured: Captured[] = [];
    const { load } = composition("/inventory/transfers", {
      [drawer]: { saving, fromWarehouseId: "wh-a", toWarehouseId: "wh-b", lines: [{ inventoryItemId: item.id, quantity: "2147483647" }] },
      [pickers[1]]: { open: true, warehouses: [{ id: "wh-a", name: caller, code: "A", address: null, isActive: true, isDefault: true }, { id: "wh-b", name: "Destination", code: "B", address: null, isActive: true, isDefault: false }] },
      [pickers[2]]: { open: true, itemsOrg: "org-a", selectedOrg: "org-a", items: [item], selected: item },
    }, captured);
    const Transfer = load(drawer).TransferDrawer;
    const html = renderWithPresentation(createElement(Transfer, { open: true, onClose: noop }), locale);
    assert.ok(html.includes(escaped(caller)) && !html.includes("<script>"));
    assert.ok(html.includes(escaped(messages.Warehouses.searchWarehouses)));
    assert.ok(html.includes('value="2147483647"'));
    assert.ok(html.includes(escaped(saving ? messages.InventoryMovements.creating : messages.InventoryMovements.createTransfer)));
    assert.equal(/<button(?=[^>]*type="submit")(?=[^>]*disabled="")/.test(html), saving);
    const ids = captured.filter(c => c.kind === "CommandItem").map(c => c.props.value);
    assert.ok(ids.includes("wh-a") && ids.includes("wh-b"));
    assert.ok(!html.includes("MISSING_MESSAGE"));
  }
});

test("item creation composes category picker and localized footer without losing exact price inputs", () => {
  for (const locale of ["en-US", "fa-IR"] as const) for (const saving of [false, true]) {
    const messages = locale === "en-US" ? en : fa;
    const { load } = composition("/inventory", { [drawer]: { saving, invPurchasePrice: "40000000000000.01", invSalePrice: "40000000000000.03" } });
    const Inventory = load(drawer).InventoryDrawer;
    const html = renderWithPresentation(createElement(Inventory, { open: true, onClose: noop }), locale);
    assert.ok(html.includes(escaped(messages.InventoryItems[saving ? "creating" : "createItem"])));
    assert.ok(html.includes(escaped(messages.InventoryCategories.selectCategory)));
    assert.ok(html.includes('value="40000000000000.01"') && html.includes('value="40000000000000.03"'), html.match(/value="[^"]*"/g)?.join(", "));
    assert.equal(/<button(?=[^>]*type="submit")(?=[^>]*disabled="")/.test(html), saving);
  }
});

test("inventory navigation retains its five canonical routes and hides itself on detail routes", () => {
  const links = ["/inventory", "/inventory/stock-takes", "/inventory/warehouses", "/inventory/transfers", "/inventory/valuation"];
  for (const locale of ["en-US", "fa-IR"] as const) for (const pathname of [...links, "/inventory/item-a", "/inventory/stock-takes/take-a", "/inventory/bom/bom-a"]) {
    const messages = locale === "en-US" ? en : fa;
    const { load } = composition(pathname);
    const Layout = load(`${root}/layout.tsx`).default;
    const html = renderWithPresentation(createElement(Layout, null, createElement("p", null, caller)), locale);
    assert.equal(html.includes("<nav"), links.includes(pathname), pathname);
    if (links.includes(pathname)) {
      for (const href of links) assert.ok(html.includes(`href="${href}"`));
      for (const label of Object.values(messages.InventoryNavigation)) assert.ok(html.includes(escaped(label)));
    }
    assert.ok(html.includes(escaped(caller)) && !html.includes("<script>"));
  }
});

test("workspace loading, missing and invalid-money states suppress nested editable details", () => {
  for (const locale of ["en-US", "fa-IR"] as const) for (const state of ["loading", "missing", "invalid"] as const) {
    const messages = locale === "en-US" ? en : fa;
    const { load } = composition(`/inventory/${item.id}`, {
      [`${root}/[id]/layout.tsx`]: { loading: state === "loading", item: state === "invalid" ? { ...item, totalValueMinor: "1" } : null },
    });
    const Workspace = load(`${root}/[id]/layout.tsx`).default;
    const Details = load(`${root}/[id]/page.tsx`).default;
    const html = renderWithPresentation(createElement(Workspace, null, createElement(Details)), locale);
    assert.ok(!html.includes('id="inv-name"') && !html.includes('value="40000000000000.01"'));
    if (state === "missing") assert.ok(html.includes(escaped(messages.InventoryItems.notFound)));
    if (state === "invalid") assert.ok(html.includes('role="alert"') && html.includes(escaped(messages.InventoryItems.readFailed)));
    assert.ok(!html.includes("aliases disagree") && !html.includes("MISSING_MESSAGE"));
  }
});

test("combined copy audit pins all 18 routes, five drawers and three shared pickers", () => {
  function files(path: string): string[] { return readdirSync(path, { withFileTypes: true }).flatMap(e => e.isDirectory() ? files(`${path}/${e.name}`) : e.name.endsWith(".tsx") ? [`${path}/${e.name}`] : []); }
  const routes = files(root);
  assert.deepEqual(routes.map(p => p.slice(root.length + 1)).sort(), ["[id]/history/page.tsx", "[id]/layout.tsx", "[id]/page.tsx", "[id]/suppliers/page.tsx", "[id]/variants/page.tsx", "alerts/page.tsx", "assembly/page.tsx", "bom/[id]/page.tsx", "bom/page.tsx", "categories/page.tsx", "layout.tsx", "loading.tsx", "page.tsx", "stock-takes/[id]/page.tsx", "stock-takes/page.tsx", "transfers/page.tsx", "valuation/page.tsx", "warehouses/page.tsx"].sort());
  for (const path of [...routes, ...pickers, drawer]) {
    const ast = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const names = new Set<string>([...drawerNames, "DrawerFooter", "SectionLabel"]);
    const owners = path === drawer ? ast.statements.filter(n => ts.isFunctionDeclaration(n) && n.name && names.has(n.name.text)) : [ast];
    function audit(n: ts.Node) {
      if (ts.isJsxText(n)) {
        const copy = n.text.trim().replace(/&(?:rarr|middot|ndash|mdash|infin);/g, "");
        assert.ok(!/[A-Za-z]/.test(copy) || ["WH-001", "WH-002", "SKU-DESK-001", "x"].includes(copy), `${path}: ${copy}`);
      }
      if (ts.isJsxAttribute(n) && ["title", "description", "placeholder", "aria-label", "alt", "label", "emptyMessage"].includes(n.name.getText(ast)) && n.initializer && ts.isStringLiteral(n.initializer)) assert.ok(!/[A-Za-z]/.test(n.initializer.text) || ["ITEM-001", "WH-001"].includes(n.initializer.text), `${path}: ${n.getText(ast)}`);
      if (ts.isCallExpression(n) && /^(toast\.(success|error)|useDocumentTitle)$/.test(n.expression.getText(ast))) assert.ok(!n.arguments.some(ts.isStringLiteral), `${path}: ${n.getText(ast)}`);
      ts.forEachChild(n, audit);
    }
    owners.forEach(audit);
  }
});
