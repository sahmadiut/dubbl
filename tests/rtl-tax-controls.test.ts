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
import { taxUiMoney } from "../lib/money/tax-ui";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";

type Props = Record<string, unknown>;
const h = React.createElement, noop = () => {};
const require = createRequire(import.meta.url);
const CjsProvider = (require("../i18n/provider") as typeof Provider).PresentationProvider;
const caller = "  \u0645\u0627\u0644\u06cc\u0627\u062a Caller <GST/001> & " + "long-name-".repeat(24);
const reference = "HMRC-001/\u062D\u0633\u0627\u0628", minor = 4000000000000001n;
const presentations = (["en-US", "fa-IR"] as const).flatMap(language => (["latn", "arabext"] as const).map(numerals => resolvePresentation({ user: { language, numerals } })));
const esc = (v: string) => v.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#x27;");
const period = { id: "period-a", name: caller, startDate: "2026-01-01", endDate: "2026-03-31", type: "quarterly", status: "filed", filedAt: "2026-04-02T00:00:00Z", filedReference: reference, notes: caller,
  lines: [{ id: "b", boxNumber: "5", label: caller, amount: -minor, sourceDescription: caller, sortOrder: 2 }, { id: "a", boxNumber: "1A", label: caller, amount: 1n, sourceDescription: caller, sortOrder: 1 }] };

// Execute the production components, provider, fields, money and shared controls.
// Only own state scheduling, effects, navigation and sheet portals are controlled.
function loaded(relative: string, exported: string, states: Props = {}, props: Props = {}) {
  const file = `app/(dashboard)/tax/${relative}`, original = readFileSync(file, "utf8");
  const ast = ts.createSourceFile(file, original, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const edits: { start: number; end: number; text: string }[] = [];
  function visit(node: ts.Node) {
    if (ts.isVariableDeclaration(node) && ts.isArrayBindingPattern(node.name) && node.initializer && ts.isCallExpression(node.initializer) && node.initializer.expression.getText(ast) === "useState") {
      let owner: ts.Node | undefined = node.parent;
      while (owner && !ts.isFunctionDeclaration(owner)) owner = owner.parent;
      assert.ok(owner && ts.isFunctionDeclaration(owner) && owner.name);
      const key = `${owner.name.text}.${node.name.elements[0].getText(ast)}`;
      edits.push({ start: node.initializer.getStart(ast), end: node.initializer.end, text: `controlledState(${JSON.stringify(key)}, ${node.initializer.arguments[0]?.getText(ast) ?? "undefined"})` });
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  let source = original;
  for (const edit of edits.sort((a, b) => b.start - a.start)) source = source.slice(0, edit.start) + edit.text + source.slice(edit.end);
  if (exported !== "default") source += `\nexport { ${exported} };`;
  const compiled = { exports: {} as Record<string, React.ComponentType<Props>> }, localRequire = createRequire(resolve(file));
  const controls: { type: unknown; props: Props }[] = [], updates: unknown[][] = [], events: unknown[] = [];
  const capture = (create: typeof jsx.jsx) => (type: React.ElementType, p: Props, key?: string) => { controls.push({ type, props: p }); return create(type, p, key); };
  const controlledState = (key: string, initial: unknown) => [key in states ? states[key] : typeof initial === "function" ? initial() : initial, (v: unknown) => updates.push([key, v])];
  const inline = ({ children }: { children: React.ReactNode }) => h("div", null, children);
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  new Function("require", "module", "exports", "controlledState", js)((id: string) => {
    if (id === "react") return { ...React, useEffect: noop, useCallback: (fn: unknown) => fn };
    if (id === "react/jsx-runtime") return { ...jsx, jsx: capture(jsx.jsx), jsxs: capture(jsx.jsxs) };
    if (id === "next-intl") return intl;
    if (id.endsWith("/i18n/provider")) return Provider;
    if (id === "next/navigation") return { useParams: () => ({ id: period.id }), useRouter: () => ({ push: (v: unknown) => events.push(v) }) };
    if (id.endsWith("/use-document-title")) return { useDocumentTitle: noop };
    if (id.endsWith("/use-entity-title")) return { useEntityTitle: noop };
    if (id.endsWith("/ui/sheet")) return Object.fromEntries(["Sheet", "SheetContent", "SheetHeader", "SheetTitle", "SheetTrigger", "SheetFooter"].map(key => [key, inline]));
    return localRequire(id.startsWith("@/") ? resolve(id.slice(2)) : id);
  }, compiled, compiled.exports, controlledState);
  return { controls, updates, events, render(p: typeof presentations[number]) {
    controls.length = 0;
    const root = { presentation: p, messages: p.locale === "fa-IR" ? fa : en, now: new Date("2026-10-26T00:00:00Z") };
    return renderToStaticMarkup(h(Provider.PresentationProvider, root, h(CjsProvider, root, h(compiled.exports[exported], props))));
  } };
}
function control(page: ReturnType<typeof loaded>, predicate: (c: { type: unknown; props: Props }) => boolean) {
  const found = page.controls.find(predicate); assert.ok(found); return found.props;
}

test("rate and currency fields retain raw caller, basis-point drafts and ISO FX controls with associated labels", () => {
  assert.match(caller, /\p{Script=Arabic}/u);
  for (const p of presentations) {
    const saved: unknown[] = [];
    const page = loaded("page.tsx", "TaxRateFormFields", {}, { name: caller, rate: "12.50", type: "both", kind: "partial_block", recoverable: "50", components: [{ name: caller, rate: 250, accountId: "bank-a" }], setName: (v: unknown) => saved.push(v), setRate: (v: unknown) => saved.push(v), setType: (v: unknown) => saved.push(v), setKind: noop, setRecoverable: noop, setComponents: (v: unknown) => saved.push(v) });
    const html = page.render(p);
    const name = control(page, c => c.props.value === caller && typeof c.props.onChange === "function");
    assert.equal(name.dir, "auto"); assert.ok(html.includes(`for="${name.id}"`) && html.includes(`id="${name.id}"`));
    (name.onChange as (e: unknown) => void)({ target: { value: caller + " raw " } }); assert.equal(saved.at(-1), caller + " raw ");
    const rate = control(page, c => c.props.value === "12.50" && typeof c.props.onChange === "function");
    assert.equal(rate.dir, "ltr"); (rate.onChange as (e: unknown) => void)({ target: { value: "12.345" } }); assert.equal(saved.at(-1), "12.345");
    const type = control(page, c => c.props.value === "both" && typeof c.props.onValueChange === "function");
    assert.equal(type.dir, localeDirection(p.locale)); (type.onValueChange as (v: string) => void)("purchase"); assert.equal(saved.at(-1), "purchase");
    const component = control(page, c => c.props.value === "2.5" && typeof c.props.onChange === "function");
    (component.onChange as (e: unknown) => void)({ target: { value: "2.51" } }); assert.deepEqual(saved.at(-1), [{ name: caller, rate: 251, accountId: "bank-a" }]);
    const fx = loaded("currencies/page.tsx", "AddRateSheet", { "AddRateSheet.baseCurrency": "USD", "AddRateSheet.targetCurrency": "KWD", "AddRateSheet.rate": "1.234567", "AddRateSheet.date": "2026-10-26" }, { open: true, setOpen: noop, onCreated: noop, orgId: "org-a" });
    const fxHtml = fx.render(p), draft = control(fx, c => c.props.value === "1.234567");
    assert.equal(draft.dir, "ltr"); assert.ok(fxHtml.includes(`for="${draft.id}"`) && fxHtml.includes('role="group" aria-labelledby='));
    (draft.onChange as (e: unknown) => void)({ target: { value: "1.234567890123" } }); assert.deepEqual(fx.updates.at(-1), ["AddRateSheet.rate", "1.234567890123"]);
  }
});

test("filed snapshots and settlement fields isolate exact signed amounts/IDs without mutating saved order", () => {
  const before = JSON.stringify(period, (_, v) => typeof v === "bigint" ? String(v) : v);
  for (const p of presentations) {
    const page = loaded("periods/[id]/page.tsx", "TaxPeriodWorkspace", { "TaxPeriodWorkspace.period": period, "TaxPeriodWorkspace.loading": false, "TaxPeriodWorkspace.currency": "USD" }, { id: period.id, orgId: "org-a" });
    const html = page.render(p);
    assert.ok(html.includes(`>${esc(reference)}</bdi>`) && html.includes(`>${esc(caller)}</bdi>`));
    assert.ok(html.includes(taxUiMoney(-minor, "USD", p)) && html.includes('dir="ltr"'));
    assert.ok(html.indexOf(">1A</bdi>") < html.indexOf(">5</bdi>"));
    assert.ok(html.includes('href="/tax/periods"') && html.includes("rtl:rotate-180"));
    const settle = loaded("periods/[id]/page.tsx", "SettleSheet", { "SettleSheet.bankGlAccountId": "bank-a", "SettleSheet.amount": "40000000000000.01", "SettleSheet.direction": "refund", "SettleSheet.reference": reference }, { period, open: true, onClose: noop, onSettled: noop, orgId: "org-a", defaultIsRefund: true, netAmount: -minor, currency: "USD" });
    const formHtml = settle.render(p), draft = control(settle, c => c.props.id === "tax-settlement-amount");
    assert.equal(draft.dir, "ltr"); assert.ok(formHtml.includes('for="tax-settlement-amount"'));
    const account = control(settle, c => c.props.value === "bank-a" && typeof c.props.onChange === "function");
    assert.deepEqual(account.typeFilter, ["asset"]); assert.equal(account.currencyFilter, "USD"); assert.equal(account.subTypeFilter, "bank");
    (account.onChange as (v: string) => void)("raw-account-id"); assert.deepEqual(settle.updates.at(-1), ["SettleSheet.bankGlAccountId", "raw-account-id"]);
    const ref = control(settle, c => c.props.value === reference && typeof c.props.onChange === "function");
    assert.equal(ref.dir, "ltr"); (ref.onChange as (e: unknown) => void)({ target: { value: reference + " raw " } }); assert.deepEqual(settle.updates.at(-1), ["SettleSheet.reference", reference + " raw "]);
  }
  assert.equal(JSON.stringify(period, (_, v) => typeof v === "bigint" ? String(v) : v), before);
});

test("VAT drill rows isolate statutory IDs/reference/exact amounts while CSV and basis/date callbacks stay raw", () => {
  const boxes = [{ box: "1", label: caller, amount: minor }, { box: "5", label: caller, amount: -minor }];
  const transaction = { journalLineId: "jl-a", date: "2026-10-26", entryNumber: 42, description: caller, reference, amount: minor, debit: minor, credit: 0n };
  for (const p of presentations) {
    const page = loaded("vat-return/page.tsx", "VatReturnPageWorkspace", { "VatReturnPageWorkspace.startDate": "2026-01-01", "VatReturnPageWorkspace.endDate": "2026-03-31", "VatReturnPageWorkspace.boxes": boxes, "VatReturnPageWorkspace.loading": false, "VatReturnPageWorkspace.currency": "USD", "VatReturnPageWorkspace.openBox": "1", "VatReturnPageWorkspace.drillData": { "1": [transaction] } }, { orgId: "org-a" });
    const html = page.render(p);
    for (const value of [reference, caller, "#42", "2026-10-26"]) assert.ok(html.includes(`>${esc(value)}</bdi>`), value);
    assert.ok(html.includes(taxUiMoney(minor, "USD", p)) && html.includes('aria-expanded="true"'));
    const cash = control(page, c => c.props["aria-pressed"] === false && typeof c.props.onClick === "function");
    (cash.onClick as () => void)(); assert.deepEqual(page.updates.at(-1), ["VatReturnPageWorkspace.basis", "cash"]);
    const filter = control(page, c => typeof c.props.onDateChange === "function");
    (filter.onDateChange as (a: string, b: string) => void)("2026-04-01", "2026-06-30"); assert.deepEqual(page.updates.slice(-2), [["VatReturnPageWorkspace.startDate", "2026-04-01"], ["VatReturnPageWorkspace.endDate", "2026-06-30"]]);
    const csv = control(page, c => c.props.filename === "vat-return");
    assert.deepEqual(csv.columns, ["box", "description", "amount", "currencyCode"]);
    assert.deepEqual(csv.data, boxes.map(b => ({ box: b.box, description: b.label, amount: b.amount.toString(), currencyCode: "USD" })));
    const widths = page.controls.filter(c => (c.props.style as Props | undefined)?.width !== undefined).map(c => (c.props.style as Props).width);
    assert.deepEqual(widths, ["100%", "0%"]);
  }
});

test("installed CSS supports logical tax controls, unclamped labels, wrapping and local table/sheet scroll", async () => {
  const compiler = await compile("@theme { --spacing:0.25rem; --breakpoint-sm:40rem; } @tailwind utilities;");
  const css = compiler.build(["start-3", "ps-9", "me-2", "ms-auto", "text-start", "text-end", "flex-wrap", "overflow-x-auto", "overflow-y-auto", "max-h-dvh", "[overflow-wrap:anywhere]", "rtl:rotate-180", "data-[size=default]:h-auto", "*:data-[slot=select-value]:line-clamp-none", "min-w-[520px]"]);
  for (const rule of ["inset-inline-start:", "padding-inline-start:", "margin-inline-end:", "margin-inline-start:", "text-align: start", "text-align: end", "flex-wrap: wrap", "overflow-x: auto", "overflow-y: auto", "max-height: 100dvh", "overflow-wrap: anywhere", "rotate: 180deg", "height: auto", "-webkit-line-clamp: unset", "min-width: 520px"]) assert.ok(css.includes(rule), rule);
});
