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
import { PresentationProvider } from "../i18n/provider";
import { resolvePresentation, type Presentation } from "../i18n/locale";
import { IdentifierText } from "../components/ui/bidi-text";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";

const h = React.createElement;
const presentations = (["en-US", "fa-IR"] as const).flatMap(language =>
  (["latn", "arabext"] as const).map(numerals => resolvePresentation({ user: { language, numerals } })));
type Props = Record<string, unknown>;
type Control = { type: unknown; props: Props };
type Row = { id: string; amountMinor: string };
const rows: Row[] = [
  { id: "INV-2026/000002", amountMinor: "900719925474099312345" },
  { id: "INV-2026/000001", amountMinor: "1250" },
  { id: "INV-2026/000003", amountMinor: "-500" },
];

// Production React, next-intl, Radix and table controls run unchanged. Capture
// actual JSX callbacks and persist only this module's state across SSR renders.
// This exercises real event bodies, not browser geometry or mounted key events.
function harness(advanced: boolean) {
  const file = `components/dashboard/data-table${advanced ? "-advanced" : ""}.tsx`;
  const require = createRequire(resolve(file));
  const controls: Control[] = [], states: unknown[] = [];
  let index = 0;
  const capture = (create: typeof jsxRuntime.jsx) => (type: React.ElementType, props: Props, key?: string) => {
    controls.push({ type, props });
    return create(type, props, key);
  };
  const compiledModule = { exports: {} as Record<string, React.ComponentType<Props>> };
  const code = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText;
  new Function("require", "module", "exports", code)((id: string) => {
    if (id === "next-intl") return nextIntl;
    if (id === "react/jsx-runtime") return { ...jsxRuntime, jsx: capture(jsxRuntime.jsx), jsxs: capture(jsxRuntime.jsxs) };
    if (id === "react") return { ...React, useState: (initial: unknown) => {
      const slot = index++;
      if (!(slot in states)) states[slot] = typeof initial === "function" ? initial() : initial;
      return [states[slot], (value: unknown) => {
        states[slot] = typeof value === "function" ? value(states[slot]) : value;
      }];
    } };
    return require(id.startsWith("@/") ? resolve(id.slice(2)) : id);
  }, compiledModule, compiledModule.exports);
  return {
    controls,
    render(p: Presentation, props: Props) {
      index = 0; controls.length = 0;
      return renderToStaticMarkup(h(PresentationProvider, { presentation: p,
        messages: p.locale === "fa-IR" ? fa : en, now: new Date("2026-10-25T00:00:00Z") },
      h(compiledModule.exports[advanced ? "DataTableAdvanced" : "DataTable"], props)));
    },
  };
}
function columns(header: string) {
  return [{ key: "id", header, sortKey: "canonical-id", sortable: true,
    getValue: (row: Row) => row.id,
    render: (row: Row) => h(IdentifierText, null, row.id) },
  { key: "amount", header: "Exact total", render: (row: Row) => h(IdentifierText, null, row.amountMinor) }];
}
function invoke(control: Control | undefined, event = {}) {
  assert.ok(control);
  assert.equal(typeof control.props.onClick, "function");
  (control.props.onClick as (event: unknown) => void)(event);
}

test("real basic table exposes column/sort semantics and exact canonical callbacks in four presentations", () => {
  for (const p of presentations) {
    const table = harness(false), sorted: string[] = [], clicked: Row[] = [];
    const header = (p.locale === "fa-IR" ? "شماره سند طولانی " : "Long document identifier ").repeat(20);
    const props = { columns: columns(header), data: rows, sortBy: "canonical-id", sortOrder: "desc",
      onSort: (key: string) => sorted.push(key), onRowClick: (row: Row) => clicked.push(row) };
    const html = table.render(p, props);
    assert.match(html, /<th[^>]*scope="col"[^>]*aria-sort="descending"/);
    assert.match(html, /<button type="button"/);
    assert.ok(html.includes(header));
    assert.ok(html.includes("whitespace-normal"));
    for (const row of rows) {
      assert.ok(html.includes(`>${row.id}</bdi>`));
      assert.ok(html.includes(`>${row.amountMinor}</bdi>`));
    }
    invoke(table.controls.find(c => c.type === "button"));
    invoke(table.controls.find(c => c.props.onClick && String(c.props.className).includes("cursor-pointer")));
    assert.deepEqual(sorted, ["canonical-id"]);
    assert.equal(clicked[0], rows[0]);
    assert.ok(table.render(p, { ...props, sortBy: "other" }).includes('aria-sort="none"'));
    assert.ok(table.render(p, { ...props, sortOrder: "asc" }).includes('aria-sort="ascending"'));
    assert.ok(table.render(p, { ...props, sortOrder: undefined }).includes('aria-sort="descending"'));
    assert.ok(!table.render(p, { ...props, onSort: undefined }).includes("aria-sort="));
    const loading = table.render(p, { ...props, loading: true });
    assert.match(loading, /<th[^>]*scope="col"/);
    assert.ok(loading.includes("whitespace-normal"));
  }
});

test("real advanced table cycles sort with native buttons and preserves sorted selection objects", () => {
  for (const p of presentations) {
    const table = harness(true), selections: Row[][] = [];
    const props = { columns: columns("سند / Document-001"), data: rows, selectable: true,
      onSelectionChange: (selected: Row[]) => selections.push(selected) };
    let html = table.render(p, props);
    assert.match(html, /<th[^>]*scope="col"[^>]*aria-sort="none"/);
    const sort = () => table.controls.find(c => c.type === "button" && c.props.children instanceof Array);
    invoke(sort());
    html = table.render(p, props);
    assert.ok(html.includes('aria-sort="ascending"'));
    assert.ok(html.indexOf(">INV-2026/000001</bdi>") < html.indexOf(">INV-2026/000002</bdi>"));
    const select = table.controls.find(c => c.type === "input" && c.props.type === "checkbox" && c.props["aria-label"] !== (p.locale === "fa-IR" ? fa : en).SharedUI.selectAll);
    assert.ok(select);
    (select.props.onChange as (event: { stopPropagation: () => void }) => void)({ stopPropagation() {} });
    assert.equal(selections[0][0], rows[1]);
    invoke(sort());
    html = table.render(p, props);
    assert.ok(html.includes('aria-sort="descending"'));
    assert.ok(html.indexOf(">INV-2026/000003</bdi>") < html.indexOf(">INV-2026/000002</bdi>"));
    invoke(sort());
    html = table.render(p, props);
    assert.ok(html.includes('aria-sort="none"'));
    assert.ok(html.indexOf(">INV-2026/000002</bdi>") < html.indexOf(">INV-2026/000001</bdi>"));
  }
});

test("real advanced search and pagination keep accessible localized names, exact values and LTR counters", () => {
  for (const p of presentations) {
    const table = harness(true), messages = p.locale === "fa-IR" ? fa : en;
    const props = { columns: columns("Identifier"), data: rows, pageSize: 1 };
    let html = table.render(p, props);
    assert.ok(html.includes(`aria-label="${messages.SharedUI.search}"`));
    assert.match(html, /<input[^>]*dir="auto"/);
    assert.match(html, /<span dir="ltr"[^>]*>1 \/ 3<\/span>/);
    assert.ok(html.includes("rtl:rotate-180"));
    assert.ok(html.includes("max-w-full"));
    assert.ok(html.includes("flex-wrap"));
    assert.ok(!html.includes("mr-1.5"));
    invoke(table.controls.find(c => c.props["aria-label"] === messages.SharedUI.nextPage));
    html = table.render(p, props);
    assert.match(html, /<span dir="ltr"[^>]*>2 \/ 3<\/span>/);
    assert.ok(html.includes(`>${rows[1].id}</bdi>`));
    const search = table.controls.find(c => c.props["aria-label"] === messages.SharedUI.search);
    assert.ok(search);
    (search.props.onChange as (event: { target: { value: string } }) => void)({ target: { value: rows[2].id } });
    html = table.render(p, props);
    assert.ok(html.includes(`value="${rows[2].id}"`));
    assert.ok(html.includes(`>${rows[2].id}</bdi>`));
    assert.ok(!html.includes(`>${rows[0].id}</bdi>`));
    assert.ok(!html.includes(`>${rows[1].id}</bdi>`));
    assert.ok(!html.includes(messages.SharedUI.nextPage));
  }
});

test("empty/loading tables keep column headers and translated messages without data mutation", () => {
  const snapshot = JSON.stringify(rows);
  for (const p of presentations) for (const advanced of [false, true]) {
    const table = harness(advanced), messages = p.locale === "fa-IR" ? fa : en;
    const props = { columns: columns("Long ".repeat(40)), data: [] };
    assert.ok(table.render(p, props).includes(messages.SharedUI.noDataFound));
    const html = table.render(p, { ...props, loading: true });
    assert.match(html, /<th[^>]*scope="col"/);
    assert.ok(html.includes("whitespace-normal"));
  }
  assert.equal(JSON.stringify(rows), snapshot);
});

test("installed CSS supports intrinsic growth, long-token wrapping, toolbar shrinkage and RTL arrows", async () => {
  const compiler = await compile("@theme { --spacing: 0.25rem; } @tailwind utilities;");
  const css = compiler.build(["h-auto", "min-h-10", "py-2", "whitespace-normal", "[overflow-wrap:anywhere]",
    "min-w-0", "max-w-full", "flex-wrap", "shrink-0", "rtl:rotate-180", "[unicode-bidi:isolate]", "text-start",
    "focus-visible:outline-2", "focus-visible:outline-offset-2", "me-1.5"]);
  for (const declaration of ["height: auto", "white-space: normal", "overflow-wrap: anywhere", "min-width: calc(var(--spacing) * 0)",
    "max-width: 100%", "flex-wrap: wrap", "flex-shrink: 0", "rotate: 180deg", "unicode-bidi: isolate", "text-align: start",
    "margin-inline-end:", ":focus-visible", ":dir(rtl)"]) assert.ok(css.includes(declaration), declaration);
});
