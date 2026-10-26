import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import * as React from "react";
import * as jsx from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import * as intl from "next-intl";
import ts from "typescript";
import { compile } from "tailwindcss";
import * as Provider from "../i18n/provider";
import { localeDirection, resolvePresentation } from "../i18n/locale";
import { assetMoneyDisplay } from "../lib/money/asset-display";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";

const h = React.createElement, noop = () => {};
const caller = "  \u062F\u0627\u0631\u0627\u06CC\u06CC Caller <ACME/001> & " + "long-name-".repeat(30);
const code = "FA-001/\u062D\u0633\u0627\u0628", minor = 4000000000000001;
const account = { code: "0001-USD/\u062D\u0633\u0627\u0628", name: caller };
const asset = { id: "asset-a", name: caller, assetNumber: code, description: caller, purchaseDate: "2026-10-18", purchasePrice: minor, accumulatedDepreciation: 29, netBookValue: minor-29, residualValue: 1, depreciationMethod: "straight_line", status: "active", usefulLifeMonths: 36, assetAccount: account, depreciationAccount: account, accumulatedDepAccount: account,
  disposalDate: "2026-10-19", disposalAmount: 29,
  depreciationEntries: [{ id: "dep-b", date: "2026-10-19", amount: 1, journalEntry: { id: "j-b", entryNumber: 42 } }, { id: "dep-a", date: "2026-10-18", amount: 28, journalEntry: { id: "j-a", entryNumber: 41 } }],
  revaluations: [{ id: "rev-a", date: "2026-10-20", revaluedAmount: minor-30, changeAmount: -1, isImpairment: true, notes: caller, journalEntry: { id: "j-c", entryNumber: 43 } }] };
const costs = [{ id: "cost-a", date: "2026-10-17", amount: 29, description: caller, journalEntry: { id: "j-d", entryNumber: 40 } }];
const form = { name: caller, defaultDepreciationMethod: "declining_balance", defaultConvention: "mid_quarter", usefulLifeMonths: "36", residualValue: "40000000000000.01", depreciationRatePct: "20.25", assetAccountId: "asset-a", depreciationAccountId: "expense-a", accumulatedDepAccountId: "", cwipAccountId: "", isActive: false };
const category = { id: "cat-a", name: caller, defaultDepreciationMethod: "declining_balance", defaultUsefulLifeMonths: 36, defaultResidualValue: minor, isActive: false };
const presentations = (["en-US", "fa-IR"] as const).flatMap(language => (["latn", "arabext"] as const).map(numerals => resolvePresentation({ user: { language, numerals } })));
type Props = Record<string, unknown>;
const require = createRequire(import.meta.url);
const CjsProvider = (require("../i18n/provider") as typeof Provider).PresentationProvider;
const escape = (s: string) => s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#x27;");

// Production templates/provider/fields/table/money; only scheduling, navigation
// and portals are controlled. Captured JSX props invoke actual authored callbacks.
function loaded(relative: string, states: Props = {}) {
  const file = "app/(dashboard)/accounting/" + relative, source = readFileSync(file, "utf8");
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const main = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.modifiers?.some(m => m.kind === ts.SyntaxKind.DefaultKeyword));
  assert.ok(main);
  const names: string[] = [];
  function hooks(n: ts.Node) {
    if (ts.isVariableDeclaration(n) && ts.isArrayBindingPattern(n.name) && n.initializer && ts.isCallExpression(n.initializer) && n.initializer.expression.getText(ast) === "useState") names.push(n.name.elements[0].getText(ast));
    ts.forEachChild(n, hooks);
  }
  hooks(main);
  const controls: { type: unknown; props: Props }[] = [], updates: unknown[][] = [], events: unknown[] = [];
  const capture = (create: typeof jsx.jsx) => (type: React.ElementType, props: Props, key?: string) => { controls.push({ type, props }); return create(type, props, key); };
  let index = 0;
  const compiled = { exports: {} as Record<string, React.ComponentType<Props>> }, localRequire = createRequire(resolve(file));
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const inline = ({ children }: { children: React.ReactNode }) => h("div", null, children);
  new Function("require", "module", "exports", js)((id: string) => {
    if (id === "react") return { ...React, useState: (initial: unknown) => {
      const key = names[index++] ?? "nested";
      return [key in states ? states[key] : typeof initial === "function" ? initial() : initial, (value: unknown) => updates.push([key, value])];
    }, useEffect: noop, useMemo: (fn: () => unknown) => fn(), useCallback: (fn: unknown) => fn };
    if (id === "react/jsx-runtime") return { ...jsx, jsx: capture(jsx.jsx), jsxs: capture(jsx.jsxs) };
    if (id === "next-intl") return intl;
    if (id.endsWith("/i18n/provider")) return Provider;
    if (id === "next/navigation") return { useParams: () => ({ id: asset.id }), useRouter: () => ({ push: (url: unknown) => events.push(url) }) };
    if (id.endsWith("/use-document-title")) return { useDocumentTitle: noop };
    if (id.endsWith("/use-debounce")) return { useDebounce: (v: unknown) => v };
    if (id.endsWith("/use-confirm")) return { useConfirm: () => ({ confirm: noop, dialog: null }) };
    if (id.endsWith("/create-drawer")) return { useCreateDrawer: () => ({ open: (...args: unknown[]) => events.push(args) }) };
    if (id.endsWith("/ui/dialog")) return Object.fromEntries(["Dialog", "DialogContent", "DialogHeader", "DialogTitle", "DialogDescription", "DialogFooter"].map(key => [key, inline]));
    if (id.endsWith("/ui/dropdown-menu")) return Object.fromEntries(["DropdownMenu", "DropdownMenuContent", "DropdownMenuItem", "DropdownMenuSeparator", "DropdownMenuTrigger"].map(key => [key, inline]));
    return localRequire(id.startsWith("@/") ? resolve(id.slice(2)) : id);
  }, compiled, compiled.exports);
  return { controls, updates, events, render(p: typeof presentations[number]) {
    index = 0; controls.length = 0;
    const props = { presentation: p, messages: p.locale === "fa-IR" ? fa : en, now: new Date("2026-10-26T00:00:00Z") };
    return renderToStaticMarkup(h(Provider.PresentationProvider, props, h(CjsProvider, props, h(compiled.exports.default))));
  } };
}
function control(page: ReturnType<typeof loaded>, predicate: (c: { type: unknown; props: Props }) => boolean) {
  const found = page.controls.find(predicate); assert.ok(found); return found.props;
}

test("asset list isolates long caller/code/exact totals and preserves raw status/search/navigation and bar ratios", () => {
  assert.match(caller, /\p{Script=Arabic}/u);
  for (const p of presentations) {
    const page = loaded("fixed-assets/page.tsx", { assets: [asset], allAssets: [asset], initialLoad: false });
    const html = page.render(p);
    assert.ok(html.includes(`>${escape(caller)}</bdi>`) && html.includes(`>${escape(code)}</bdi>`));
    assert.ok(html.includes(assetMoneyDisplay(minor, p)) && html.includes(assetMoneyDisplay(minor-29, p)));
    assert.ok(!html.includes("<script>") && !html.includes("$&lt;IdentifierText"));
    const bars = page.controls.filter(c => (c.props.style as Props | undefined)?.width !== undefined);
    assert.ok(bars.length >= 2);
    for (const bar of bars) assert.match(String((bar.props.style as Props).width), /^\d+(?:\.\d+)?%$/);
    const search = control(page, c => c.props.placeholder === (p.locale === "fa-IR" ? fa : en).FixedAssets.search);
    assert.equal(search.dir, "auto"); assert.equal(typeof search["aria-label"], "string");
    (search.onChange as (e: unknown) => void)({ target: { value: code } }); assert.deepEqual(page.updates.at(-1), ["search", code]);
    const tabs = control(page, c => c.props.value === "all" && typeof c.props.onValueChange === "function");
    assert.equal(tabs.dir, localeDirection(p.locale));
    (tabs.onValueChange as (value: string) => void)("fully_depreciated"); assert.deepEqual(page.updates.at(-1), ["statusFilter", "fully_depreciated"]);
    const table = control(page, c => typeof c.props.onRowClick === "function");
    (table.onRowClick as (r: unknown) => void)(asset); assert.equal(page.events.at(-1), `/accounting/fixed-assets/${asset.id}`);
    const add = control(page, c => Boolean(c.props.children) && typeof c.props.onClick === "function" && String(c.props.className).includes("bg-emerald-600"));
    (add.onClick as () => void)(); assert.deepEqual(page.events.at(-1), ["fixedAsset"]);
  }
});

test("asset detail preserves unsorted saved histories, isolates signed values/references and retains technical native controls", () => {
  const before = JSON.stringify({ asset, costs });
  for (const p of presentations) {
    const page = loaded("fixed-assets/[id]/page.tsx", { asset, cwipCosts: costs, loading: false, disposeAmount: "40000000000000.01", costAmount: "0.29" });
    const html = page.render(p);
    assert.ok(html.includes(`>${escape(caller)}</bdi>`) && html.includes(`>${escape(account.code)}</bdi>`));
    assert.ok(html.includes(assetMoneyDisplay(minor, p)) && html.includes(`>-${assetMoneyDisplay(1, p)}</bdi>`));
    assert.match(html, /<bdi[^>]*dir="ltr"[^>]*>2026-10-19<\/bdi>/);
    assert.match(html, /<bdi[^>]*dir="ltr"[^>]*>\s*#42\s*<\/bdi>/);
    const history = html.slice(html.indexOf("min-w-[360px]"));
    assert.ok(history.indexOf(">2026-10-19</bdi>") < history.indexOf(">2026-10-18</bdi>"));
    assert.ok(html.includes("rtl:rotate-180") && html.includes('href="/accounting/fixed-assets"'));
    for (const id of ["disposeAmount", "disposeDate", "revalueAmount", "revalueDate", "revalueNotes", "impairAmount", "impairDate", "impairNotes", "capitalizeDate", "costAmount", "costDate", "costDescription"]) {
      assert.ok(html.includes(`for="fa-${id}"`) && html.includes(`id="fa-${id}"`), id);
    }
    const date = control(page, c => c.props.id === "fa-disposeDate"); assert.equal(date.dir, "ltr");
    (date.onChange as (e: unknown) => void)({ target: { value: "2026-11-01" } }); assert.deepEqual(page.updates.at(-1), ["disposeDate", "2026-11-01"]);
    const amount = control(page, c => c.props.id === "fa-disposeAmount");
    (amount.onChange as (v: string) => void)("40000000000000.01"); assert.deepEqual(page.updates.at(-1), ["disposeAmount", "40000000000000.01"]);
    const notes = control(page, c => c.props.id === "fa-revalueNotes"); assert.equal(notes.dir, "auto");
    (notes.onChange as (e: unknown) => void)({ target: { value: caller } }); assert.deepEqual(page.updates.at(-1), ["revalueNotes", caller]);
    const source = control(page, c => c.props.value === "" && typeof c.props.onChange === "function" && c.props.placeholder === (p.locale === "fa-IR" ? fa : en).FixedAssets.sourcePlaceholder);
    (source.onChange as (v: string) => void)("raw-account-id"); assert.deepEqual(page.updates.at(-1), ["costSourceAccountId", "raw-account-id"]);
    assert.ok(html.includes('role="group" aria-labelledby="fa-cost-source"'));
  }
  assert.equal(JSON.stringify({ asset, costs }), before);
});

test("category editor associates controls and keeps untrimmed caller, ISO decimal drafts and raw method/account callbacks", () => {
  for (const p of presentations) {
    const page = loaded("asset-categories/page.tsx", { categories: [category], initialLoad: false, dialogOpen: true, form });
    const html = page.render(p);
    assert.ok(html.includes(`>${escape(caller)}</bdi>`) && html.includes(assetMoneyDisplay(minor, p)));
    for (const id of ["name", "method", "convention", "life", "residual", "rate", "active"]) assert.ok(html.includes(`for="ac-${id}"`) && html.includes(`id="ac-${id}"`), id);
    for (const key of ["assetAccount", "expenseAccount", "accumulatedAccount", "cwipAccount"]) assert.ok(html.includes(`aria-labelledby="ac-${key}"`) && html.includes(`id="ac-${key}"`));
    const name = control(page, c => c.props.id === "ac-name"); assert.equal(name.dir, "auto");
    (name.onChange as (e: unknown) => void)({ target: { value: caller } });
    assert.deepEqual((page.updates.at(-1)?.[1] as (f: typeof form) => typeof form)(form), { ...form, name: caller });
    const residual = control(page, c => c.props.id === "ac-residual"); assert.equal(residual.dir, "ltr");
    (residual.onChange as (e: unknown) => void)({ target: { value: "40000000000000.01" } });
    assert.equal((page.updates.at(-1)?.[1] as (f: typeof form) => typeof form)(form).residualValue, "40000000000000.01");
    const method = control(page, c => c.props.value === "declining_balance" && typeof c.props.onValueChange === "function");
    assert.equal(method.dir, localeDirection(p.locale)); (method.onValueChange as (v: string) => void)("straight_line");
    assert.equal((page.updates.at(-1)?.[1] as (f: typeof form) => typeof form)(form).defaultDepreciationMethod, "straight_line");
    const picker = control(page, c => c.props.value === "asset-a" && typeof c.props.onChange === "function");
    (picker.onChange as (v: string) => void)("raw-account-id");
    assert.equal((page.updates.at(-1)?.[1] as (f: typeof form) => typeof form)(form).assetAccountId, "raw-account-id");
  }
});

test("installed CSS keeps asset geometry logical, long values wrapping, and history scroll local", async () => {
  const compiler = await compile("@theme { --spacing:0.25rem; --breakpoint-sm:40rem; } @tailwind utilities;");
  const css = compiler.build(["start-2.5", "ps-8", "me-2", "ms-1.5", "text-end", "flex-wrap", "overflow-x-auto", "overflow-y-auto", "max-h-[90dvh]", "[overflow-wrap:anywhere]", "rtl:rotate-180", "min-[360px]:grid-cols-2", "data-[size=default]:h-auto", "*:data-[slot=select-value]:line-clamp-none"]);
  for (const declaration of ["inset-inline-start:", "padding-inline-start:", "margin-inline-end:", "margin-inline-start:", "text-align: end", "flex-wrap: wrap", "overflow-x: auto", "overflow-y: auto", "max-height: 90dvh", "overflow-wrap: anywhere", "rotate: 180deg", "height: auto", "-webkit-line-clamp: unset"]) assert.ok(css.includes(declaration), declaration);
});
