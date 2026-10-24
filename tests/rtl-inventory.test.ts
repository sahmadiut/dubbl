import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import * as React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import * as nextIntl from "next-intl";
import { compile } from "tailwindcss";
import ts from "typescript";
import * as Presentation from "../i18n/provider";
import * as CurrencyInput from "../components/ui/currency-input";
import { resolvePresentation } from "../i18n/locale";
import { bankMoneyDisplay } from "../lib/money/bank-display";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";

const h = React.createElement, noop = () => {};
const root = "app/(dashboard)/inventory/";
const presentations = (["en-US", "fa-IR"] as const).flatMap(language =>
  (["latn", "arabext"] as const).map(numerals => resolvePresentation({ user: { language, numerals } })));
const caller = "  \u0646\u0627\u0645 Caller <ACME/001> & " + "long-name-".repeat(35);
const code = "  SKU-001/ABC  ";
const escaped = (s: string) => s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;").replaceAll("'", "&#x27;");
const item = { id: "item/001", code, sku: code, name: caller, category: caller, categoryId: "category/001",
  description: caller, purchasePrice: 4000000000000001, purchasePriceMinor: "4000000000000001",
  salePrice: 4000000000000003, salePriceMinor: "4000000000000003", totalValue: 4000000000000001, totalValueMinor: "4000000000000001", priceValue: 4000000000000001, priceValueMinor: "4000000000000001", quantityOnHand: 1, reorderPoint: 2, isActive: true };
type Props = Record<string, unknown>;

// Execute production templates/callbacks and native controls with actual Intl and
// presentation provider. State, navigation, charts and unowned widgets are controlled.
function loaded(file: string, name: string, states: Props = {}, events: unknown[] = []) {
  const require = createRequire(resolve(root + file));
  let index = 0;
  const controls: { type: unknown; props: Props }[] = [], updates: [string, unknown][] = [];
  const inline = ({ children }: { children: React.ReactNode }) => h("div", null, children);
  const capture = (create: typeof jsxRuntime.jsx) => (type: React.ElementType, props: Props, key?: string) => {
    controls.push({ type, props }); return create(type, props, key);
  };
  let source = readFileSync(root + file, "utf8");
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const component = ast.statements.find(n => ts.isFunctionDeclaration(n) && (name === "default"
    ? n.modifiers?.some(m => m.kind === ts.SyntaxKind.DefaultKeyword) : n.name?.text === name));
  assert.ok(component);
  const names: string[] = [];
  function hooks(n: ts.Node) {
    if (ts.isVariableDeclaration(n) && ts.isArrayBindingPattern(n.name) && n.initializer && ts.isCallExpression(n.initializer)
      && n.initializer.expression.getText(ast) === "useState") names.push(n.name.elements[0].getText(ast));
    ts.forEachChild(n, hooks);
  }
  hooks(component);
  if (name !== "default") source += `\nexport { ${name} };`;
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const compiled = { exports: {} as Record<string, React.ComponentType<Props>> };
  new Function("require", "module", "exports", code)((id: string) => {
    if (id === "react") return { ...React, useState: (initial: unknown) => {
      const key = names[index++]; return [key in states ? states[key] : typeof initial === "function" ? initial() : initial,
        (value: unknown) => updates.push([key, value])];
    }, useEffect: noop };
    if (id === "next-intl") return nextIntl;
    if (id.endsWith("/i18n/provider")) return Presentation;
    if (id.endsWith("/ui/currency-input")) return CurrencyInput;
    if (id === "react/jsx-runtime") return { ...jsxRuntime, jsx: capture(jsxRuntime.jsx), jsxs: capture(jsxRuntime.jsxs) };
    if (id === "next/navigation") return { useParams: () => ({ id: item.id }), usePathname: () => "/inventory",
      useRouter: () => ({ push: (value: unknown) => events.push(value) }) };
    if (id.endsWith("/layout")) return { useInventoryItem: () => ({ item, setItem: noop, refetch: noop }) };
    if (id.endsWith("/use-document-title")) return { useDocumentTitle: noop };
    if (id.endsWith("/use-debounce")) return { useDebounce: (value: unknown) => value };
    if (id.endsWith("/use-confirm")) return { useConfirm: () => ({ confirm: noop, dialog: null }) };
    if (id.endsWith("/category-picker")) return { CategoryPicker: () => null };
    if (id.endsWith("/create-drawer")) return { useCreateDrawer: () => ({ open: noop }) };
    if (id === "recharts") return new Proxy({}, { get: (_o, key) => key === "ResponsiveContainer" ? ({ children }: { children: React.ReactNode }) => h("svg", null, children) : inline });
    if (["/ui/dialog", "/ui/sheet"].some(s => id.endsWith(s))) return new Proxy({}, { get: (_o, key) =>
      key === "Dialog" || key === "Sheet" ? ({ open, children }: { open: boolean; children: React.ReactNode }) => open ? inline({ children }) : null : inline });
    return require(id.startsWith("@/") ? resolve(id.slice(2)) : id);
  }, compiled, compiled.exports);
  return { controls, updates, render(p: typeof presentations[number], props: Props = {}) {
    index = 0; controls.length = 0;
    return renderToStaticMarkup(h(Presentation.PresentationProvider, { presentation: p, messages: p.locale === "fa-IR" ? fa : en,
      now: new Date("2026-10-25T00:00:00Z") }, h(compiled.exports[name], props)));
  } };
}

test("actual inventory categories isolate long caller text and preserve hierarchy/actions in all four presentations", () => {
  const category = { id: "category/001", name: caller, description: caller, color: "#10b981" };
  for (const p of presentations) {
    const row = loaded("categories/page.tsx", "CategoryRow"), edited: unknown[] = [], removed: unknown[] = [];
    const html = row.render(p, { category, depth: 2, onEdit: (value: unknown) => edited.push(value), onDelete: (value: unknown) => removed.push(value) });
    assert.ok(html.includes(`>${escaped(caller)}</bdi>`));
    assert.ok(html.includes("padding-inline-start:64px")); assert.ok(html.includes("rtl:rotate-180"));
    const labels = (p.locale === "fa-IR" ? fa : en).InventoryCategories;
    for (const [label, out] of [[labels.editCategory, edited], [labels.delete, removed]] as const) {
      const action = row.controls.find(c => c.props["aria-label"] === label); assert.ok(action);
      (action.props.onClick as () => void)(); assert.equal(out[0], category);
    }
    assert.equal(category.name, caller);
  }
});

test("actual stock counter retains ordered numeric entry and exact line/quantity callbacks", () => {
  const line = { id: "line/001", expectedQuantity: 9, countedQuantity: 3 };
  for (const p of presentations) {
    const row = loaded("stock-takes/[id]/page.tsx", "CounterCell", { editing: true, editValue: "12" }), changes: unknown[] = [];
    const html = row.render(p, { line, isSaving: false, onUpdate: (...args: unknown[]) => changes.push(args) });
    assert.ok(html.includes('dir="ltr"'));
    const input = row.controls.find(c => c.type === "input"); assert.ok(input);
    assert.equal(input.props.inputMode, "numeric"); assert.equal(input.props.dir, "ltr"); assert.equal(input.props.value, "12"); assert.ok(input.props["aria-label"]);
    (input.props.onBlur as () => void)(); assert.deepEqual(changes, [[line.id, 12]]);
    (input.props.onChange as (event: { target: { value: string } }) => void)({ target: { value: "0012" } });
    assert.ok(row.updates.some(([key, value]) => key === "editValue" && value === "0012"));
    const actions = row.controls.filter(c => c.type === "button");
    (actions[0].props.onClick as () => void)(); (actions[1].props.onClick as () => void)();
    assert.deepEqual(changes.slice(1), [[line.id, 2], [line.id, 4]]);
  }
});

test("actual item forms preserve native identities, exact drafts, associated labels and growing actions", () => {
  for (const p of presentations) {
    const form = loaded("[id]/page.tsx", "default", { revalueOpen: true }), html = form.render(p);
    for (const [name, value, dir] of [["code", code, "ltr"], ["sku", code, "ltr"], ["name", caller, "auto"], ["description", caller, "auto"]]) {
      const input = form.controls.find(c => c.props.name === name)?.props; assert.ok(input);
      assert.equal(input.defaultValue, value); assert.equal(input.dir, dir);
    }
    assert.ok(form.controls.some(c => c.type === CurrencyInput.CurrencyInput && c.props.value === "40000000000000.01"));
    assert.ok(html.includes("h-auto")); assert.ok(html.includes("whitespace-normal"));
    const labels = (p.locale === "fa-IR" ? fa : en).InventoryItems;
    const reason = form.controls.find(c => c.props["aria-label"] === labels.reasonRequired); assert.ok(reason);
    assert.ok(reason.props.id); assert.ok(html.includes(`for="${reason.props.id}"`));
  }
});

test("actual inventory list isolates selectable codes and exact money without changing row destinations or chronology", () => {
  for (const p of presentations) {
    const events: unknown[] = [], chartData = [{ date: "2026-10-24", in: 2, out: 1, net: 1 }];
    const page = loaded("page.tsx", "default", { items: [item], loading: false, summary: { totalItems: 1, totalValueMinor: item.purchasePriceMinor,
      lowStockCount: 1, avgMargin: 0, avgMarginExact: "0" }, chartData, categories: [caller] }, events);
    const html = page.render(p);
    assert.match(html, /<bdi[^>]*dir="ltr"[^>]*>  SKU-001\/ABC  <\/bdi>/);
    assert.ok(html.includes(`>${escaped(caller)}</bdi>`));
    assert.ok(html.includes(escaped(bankMoneyDisplay(BigInt(item.salePriceMinor), "USD", p))));
    assert.ok(html.includes('<div dir="ltr" class="min-w-0">'));
    const search = page.controls.find(c => c.props.placeholder === (p.locale === "fa-IR" ? fa : en).InventoryItems.searchAll);
    assert.ok(search); assert.ok(search.props["aria-label"]); assert.ok(String(search.props.className).includes("ps-9"));
    const row = page.controls.find(c => typeof c.props.onClick === "function" && String(c.props.onClick).includes('item.id'));
    assert.ok(row); (row.props.onClick as () => void)(); assert.deepEqual(events, [`/inventory/${item.id}`]);
    assert.equal(chartData[0].date, "2026-10-24"); assert.equal(item.code, code);
  }
});

test("installed inventory CSS supplies logical spacing, intrinsic wrapping and select height/value overrides", async () => {
  const compiler = await compile("@theme { --spacing: 0.25rem; } @tailwind utilities;");
  const css = compiler.build(["start-3", "end-2.5", "ps-9", "pe-8", "me-1.5", "text-start", "text-end", "border-s-0", "rounded-s-md",
    "h-auto", "min-w-0", "flex-wrap", "[overflow-wrap:anywhere]", "data-[size=default]:h-auto", "data-[size=sm]:h-auto",
    "*:data-[slot=select-value]:line-clamp-none", "*:data-[slot=select-value]:whitespace-normal", "rtl:rotate-180"]);
  for (const declaration of ["inset-inline-start:", "inset-inline-end:", "padding-inline-start:", "padding-inline-end:", "margin-inline-end:",
    "text-align: start", "text-align: end", "height: auto", "min-width:", "flex-wrap: wrap", "overflow-wrap: anywhere",
    "-webkit-line-clamp: unset", "white-space: normal", "rotate: 180deg"])
    assert.ok(css.includes(declaration), declaration);
});
