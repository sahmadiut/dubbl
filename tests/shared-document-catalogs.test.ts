import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import * as React from "react";
import { createElement, type ReactElement, type ReactNode } from "react";
import * as nextIntl from "next-intl";
import { createTranslator } from "next-intl";
import ts from "typescript";
import { PathnameContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime";
import SalesLayout from "../app/(dashboard)/sales/layout";
import Loading from "../app/(dashboard)/sales/loading";
import { InvoiceAmountInput } from "../components/dashboard/invoice-amount-input";
import { LineItemsEditor, type LineItem } from "../components/dashboard/line-items-editor";
import { documentPreviewMessage } from "../i18n/document-form-presentation";
import { documentEditorPreview } from "../lib/money/document-editor";
import { billEditorPreview } from "../lib/money/bill-editor";
import { recurringInvoiceEditorPreview } from "../lib/money/recurring-invoice-ui";
import { recurringBillEditorPreview } from "../lib/money/recurring-bill-ui";
import { procurementPreview } from "../lib/money/procurement-ui";
import { renderWithPresentation } from "./helpers/presentation";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";

const locales = ["en-US", "fa-IR"] as const;
const noop = () => {};
const caller = "<script>customer & supplier</script>";
const row: LineItem = { description: caller, quantity: "3", unitPrice: "0.005", accountId: "11111111-1111-4111-8111-111111111111", taxRateId: "33333333-3333-4333-8333-333333333333" };
const editorPath = "components/dashboard/line-items-editor.tsx";
const drawerPath = "components/dashboard/create-drawer.tsx";
const translate = (locale: typeof locales[number]) => createTranslator({ locale, messages: locale === "en-US" ? en : fa, namespace: "DocumentForms" });
const escaped = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#x27;");

type ElementProps = Record<string, unknown> & { children?: ReactNode };
function elements(node: ReactNode): ReactElement<ElementProps>[] {
  return React.Children.toArray(node).flatMap(child => React.isValidElement<ElementProps>(child) ? [child, ...elements(child.props.children)] : []);
}

// Use the production functions, real next-intl and actual money calculators.
// Only local state/effects and portal contents have controlled test boundaries.
function controlled(path: string, name: string, rates: unknown[] = [], effects: (() => unknown)[] = []) {
  const ast = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let source = ast.text;
  if (path === drawerPath) {
    source = 'import { useTranslations } from "next-intl"; import { Button } from "@/components/ui/button";\n' +
      ast.statements.filter(n => ts.isFunctionDeclaration(n) && n.name && [name, "SectionLabel"].includes(n.name.text)).map(n => n.getText(ast)).join("\n");
  }
  source += `\nexport { ${name} };`;
  const require = createRequire(resolve(path));
  const compiled = { exports: {} as Record<string, (props: Record<string, unknown>) => ReactElement> };
  const inline = ({ children }: { children?: ReactNode }) => createElement("div", null, children);
  const load = (id: string) => {
    if (id === "react") return { ...React, useState: () => [rates, noop], useEffect: (effect: () => unknown) => effects.push(effect) };
    if (id === "next-intl") return nextIntl;
    if (id.endsWith("/ui/select")) return { Select: inline, SelectContent: inline, SelectTrigger: inline, SelectValue: ({ placeholder }: { placeholder?: string }) => createElement("span", null, placeholder), SelectItem: ({ children, value }: { children: ReactNode; value: string }) => createElement("span", { "data-option": value }, children) };
    if (id === "./account-picker") return { AccountPicker: ({ value, placeholder }: { value: string; placeholder: string }) => createElement("span", { "data-account": value }, placeholder) };
    return require(id.startsWith("@/") ? resolve(id.slice(2)) : id);
  };
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  new Function("require", "module", "exports", code)(load, compiled, compiled.exports);
  return compiled.exports[name];
}

function capture<P>(Component: (props: P) => ReactElement, props: P, locale: typeof locales[number]) {
  let tree: ReactNode;
  function Capture() { tree = Component(props); return tree; }
  const html = renderWithPresentation(createElement(Capture), locale);
  return { html, nodes: elements(tree) };
}

test("sales tabs and loading render both catalogs with canonical navigation and detail visibility", () => {
  const routes = ["/sales", "/sales/quotes", "/sales/receipts", "/sales/credit-notes", "/sales/payments", "/sales/customer-prepayments", "/sales/revenue-schedules", "/sales/recurring"];
  for (const locale of locales) {
    const messages = locale === "en-US" ? en : fa;
    const html = renderWithPresentation(createElement(PathnameContext.Provider, { value: "/sales" }, createElement(SalesLayout, null, caller)), locale);
    for (const text of Object.values(messages.SalesNavigation)) assert.ok(html.includes(escaped(text)), text);
    for (const route of routes) assert.ok(html.includes(`href="${route}"`), route);
    assert.ok(html.includes(escaped(caller)) && !html.includes("<script>"));
    const detail = renderWithPresentation(createElement(PathnameContext.Provider, { value: "/sales/quotes/quote-a" }, createElement(SalesLayout, null, caller)), locale);
    assert.ok(!detail.includes("<nav") && detail.includes(escaped(caller)));
    const loading = renderWithPresentation(createElement(Loading), locale);
    assert.ok(loading.includes(`aria-label="${escaped(messages.SharedUI.loading2)}"`));
  }
});

test("shared line controls render bilingual fields, exact currency scales and existing rounding policies", () => {
  for (const locale of locales) {
    const t = translate(locale);
    for (const [currency, unitPrice, expected] of [["USD", "90071992547409.91", "90071992547409.91"], ["JPY", "1250", "1250"], ["KWD", "1.251", "1.251"]]) {
      const html = renderWithPresentation(createElement(LineItemsEditor, { lines: [{ ...row, quantity: "1", taxRateId: "", unitPrice }], onChange: noop, currencyCode: currency, priceFractionDigits: 18 }), locale);
      for (const key of ["description", "quantity", "amount", "itemDescription", "account", "addLine", "subtotal", "tax", "total"] as const) assert.ok(html.includes(escaped(t(key))), key);
      for (const key of ["priceLine", "quantityLine", "removeLine"] as const) assert.ok(html.includes(`aria-label="${escaped(t(key, { number: 1 }))}"`));
      assert.ok(html.includes(escaped(t("priceCurrency", { currency }))) && html.includes(`${expected}</span>`));
      assert.ok(html.includes(escaped(caller)) && !html.includes("<script>"));
      assert.match(html, /inputMode="decimal"/);
    }
    for (const kind of ["invoice", "bill", "recurringInvoice", "recurringBill", "purchaseOrder"] as const) {
      const rate = { id: "33333333-3333-4333-8333-333333333333", name: caller, rate: 2000, kind: "standard", recoverablePercent: 5000 };
      const Editor = controlled(editorPath, "LineItemsEditor", [rate]);
      const html = renderWithPresentation(createElement(Editor, { lines: [row], onChange: noop, currencyCode: "USD", documentKind: kind, taxContext: "purchase", priceFractionDigits: 18 }), locale);
      const preview = kind === "bill" ? billEditorPreview([row], "USD", [rate]) : kind === "recurringInvoice" ? recurringInvoiceEditorPreview([row], "USD", [rate]) : kind === "recurringBill" ? recurringBillEditorPreview([row], "USD", [rate]) : kind === "purchaseOrder" ? procurementPreview([row], "USD", [rate]) : documentEditorPreview([row], "USD", [rate]);
      assert.equal(preview.error, null);
      assert.ok(html.includes(kind.startsWith("recurring") ? "0.03</span>" : "0.02</span>"));
      assert.ok(html.includes(escaped(t("partlyReclaimable", { percent: "50" }))));
      assert.ok(html.includes(escaped(t("noTax"))));
      assert.ok(html.includes('data-option="33333333-3333-4333-8333-333333333333"') && html.includes('data-option="none"'));
      assert.ok(html.includes(escaped(caller)) && !html.includes("<script>"));
      if (kind === "bill") assert.ok(html.includes(escaped(t("amountDue"))));
      if (kind === "recurringBill") for (const text of [t("priceFixedScale"), t("recurringBillScale", { currency: "USD" })]) assert.ok(html.includes(escaped(text)));
    }
    for (const rate of [{ rate: 2000, kind: "standard" }, { rate: 2000, kind: "standard", recoverablePercent: 0 }, { rate: 0, kind: "exempt" }, { rate: 2000, kind: "no_vat" }, { rate: 2000, kind: "sales_tax_us" }]) {
      const Editor = controlled(editorPath, "LineItemsEditor", [{ ...rate, id: "33333333-3333-4333-8333-333333333333", name: caller }]);
      const props = { lines: [row], onChange: noop, currencyCode: "USD", taxContext: "purchase" };
      const html = renderWithPresentation(createElement(Editor, props), locale);
      const key = rate.kind === "standard" && rate.recoverablePercent === undefined ? "reclaimable" : "notReclaimable";
      assert.ok(html.includes(escaped(t(key))));
      const sales = renderWithPresentation(createElement(Editor, { ...props, taxContext: "sales" }), locale);
      assert.ok(!sales.includes(escaped(t(key))));
    }
  }
});

test("line callbacks preserve raw decimals, IDs, add/remove limits and validity reporting in both locales", () => {
  for (const locale of locales) {
    const t = translate(locale), changed: LineItem[][] = [], validity: boolean[] = [], effects: (() => unknown)[] = [];
    const Editor = controlled(editorPath, "LineItemsEditor", [{ id: "33333333-3333-4333-8333-333333333333", name: "Tax", rate: 2000 }], effects);
    const props = { lines: [row], onChange: (lines: LineItem[]) => changed.push(lines), currencyCode: "USD", priceFractionDigits: 18, onValidityChange: (valid: boolean) => validity.push(valid) };
    const { nodes } = capture(Editor, props, locale);
    function field(label: string) { return nodes.find(n => n.props["aria-label"] === label)!; }
    (field(t("quantityLine", { number: 1 })).props.onChange as (event: unknown) => void)({ target: { value: "3.125" } });
    assert.deepEqual(changed.pop(), [{ ...row, quantity: "3.125" }]);
    (field(t("priceLine", { number: 1 })).props.onChange as (value: string) => void)("90071992547409.91");
    assert.deepEqual(changed.pop(), [{ ...row, unitPrice: "90071992547409.91" }]);
    const description = nodes.find(n => n.props.placeholder === t("itemDescription"))!;
    (description.props.onChange as (event: unknown) => void)({ target: { value: caller } });
    assert.deepEqual(changed.pop(), [row]);
    const account = nodes.find(n => n.props.typeFilter !== undefined || n.props.placeholder === t("account"))!;
    (account.props.onChange as (value: string) => void)("22222222-2222-4222-8222-222222222222");
    assert.deepEqual(changed.pop(), [{ ...row, accountId: "22222222-2222-4222-8222-222222222222" }]);
    const tax = nodes.find(n => n.props.onValueChange)!;
    (tax.props.onValueChange as (value: string) => void)("none");
    assert.deepEqual(changed.pop(), [{ ...row, taxRateId: "" }]);
    (tax.props.onValueChange as (value: string) => void)("44444444-4444-4444-8444-444444444444");
    assert.deepEqual(changed.pop(), [{ ...row, taxRateId: "44444444-4444-4444-8444-444444444444" }]);
    const remove = field(t("removeLine", { number: 1 }));
    assert.equal(remove.props.disabled, true);
    (remove.props.onClick as () => void)(); assert.equal(changed.length, 0);
    const add = nodes.find(n => n.props.onClick && elements(n.props.children).length === 1 && React.Children.toArray(n.props.children).includes(t("addLine")))!;
    (add.props.onClick as () => void)();
    assert.deepEqual(changed.pop(), [row, { description: "", quantity: "1", unitPrice: "", accountId: "", taxRateId: "" }]);
    const two = capture(Editor, { ...props, lines: [row, { ...row, description: "second" }] }, locale);
    const removeFirst = two.nodes.find(n => n.props["aria-label"] === t("removeLine", { number: 1 }))!;
    assert.equal(removeFirst.props.disabled, false);
    (removeFirst.props.onClick as () => void)(); assert.deepEqual(changed.pop(), [{ ...row, description: "second" }]);
    effects[1](); assert.deepEqual(validity, [true]);
    capture(Editor, { ...props, currencyCode: null }, locale);
    effects.at(-1)!(); assert.deepEqual(validity, [true, false]);
  }
});

test("preview failures use localized reviewed messages and suppress invalid totals", () => {
  for (const locale of locales) {
    const t = translate(locale);
    for (const [currencyCode, unitPrice, key] of [[null, "1", "invoiceCurrencyError"], ["USD", "1x", "priceError"], ["USD", "90071992547409.92", "rangeError"], ["NOT_A_CURRENCY", "1", "amountError"]] as const) {
      const html = renderWithPresentation(createElement(LineItemsEditor, { lines: [{ ...row, taxRateId: "", unitPrice }], onChange: noop, currencyCode }), locale);
      assert.ok(html.includes('role="alert"') && html.includes(escaped(t(key))));
      assert.ok(!html.includes(">0.00</span>") && !html.includes("Unsupported currency:"));
    }
    const missing = renderWithPresentation(createElement(LineItemsEditor, { lines: [row], onChange: noop, currencyCode: "USD", documentKind: "bill" }), locale);
    assert.ok(missing.includes(escaped(t("reloadTaxError"))));
    const ast = ts.createSourceFile("mapping.ts", readFileSync("i18n/document-form-presentation.ts", "utf8"), ts.ScriptTarget.Latest, true);
    const cases: string[] = [];
    function visit(n: ts.Node) { if (ts.isCaseClause(n) && ts.isStringLiteral(n.expression)) cases.push(n.expression.text); ts.forEachChild(n, visit); }
    visit(ast);
    for (const message of cases) assert.notEqual(documentPreviewMessage(t, message), t("amountError"));
    for (const message of [caller, "constructor", "__proto__", "private parser prose", '[{"message":"private"}]']) assert.equal(documentPreviewMessage(t, message), t("amountError"));
  }
});

test("amount input and shared footer preserve custom labels, validation, callbacks and saving state", () => {
  for (const locale of locales) {
    const t = translate(locale);
    for (const [currency, invalid, valid] of [["USD", "0.001", "12.50"], ["JPY", "0.1", "1250"], ["KWD", "0.0001", "1.251"]]) {
      const html = renderWithPresentation(createElement(InvoiceAmountInput, { currency, value: invalid, onChange: noop }), locale);
      assert.ok(html.includes(escaped(t("invalidAmount", { currency }))) && html.includes(escaped(t("amountCurrency", { currency }))));
      assert.match(html, /aria-invalid="true"/);
      for (const value of ["", valid]) assert.ok(!renderWithPresentation(createElement(InvoiceAmountInput, { currency, value, onChange: noop }), locale).includes('role="alert"'));
      const custom = renderWithPresentation(createElement(InvoiceAmountInput, { currency, value: invalid, onChange: noop, label: caller, invalidMessage: caller, placeholder: "123.456" }), locale);
      assert.ok(custom.includes(escaped(caller)) && custom.includes('placeholder="123.456"') && !custom.includes("<script>"));
    }
    let amount = "", closed = 0;
    const input = capture(InvoiceAmountInput, { currency: "USD", value: "", onChange: (value: string) => { amount = value; } }, locale);
    (input.nodes.find(n => n.props.fractionDigits === 2)!.props.onChange as (value: string) => void)("90071992547409.91");
    assert.equal(amount, "90071992547409.91");
    const Footer = controlled(drawerPath, "DrawerFooter");
    for (const saving of [false, true]) for (const disabled of [false, true]) {
      const { html, nodes } = capture(Footer, { label: caller, onClose: () => closed++, saving, disabled }, locale);
      assert.ok(html.includes(escaped(t("cancel"))) && html.includes(escaped(saving ? t("creating") : caller)));
      assert.equal(nodes.find(n => n.props.type === "submit")!.props.disabled, saving || disabled);
      (nodes.find(n => n.props.type === "button")!.props.onClick as () => void)();
    }
    assert.equal(closed, 4);
    const customFooter = renderWithPresentation(createElement(Footer, { label: "Create", onClose: noop, saving: true, cancelLabel: caller, creatingLabel: caller }), locale);
    assert.ok(customFooter.includes(escaped(caller)) && !customFooter.includes("<script>"));
  }
});

test("bounded sources contain no authored JSX copy and both new Persian namespaces contain script", () => {
  for (const path of [editorPath, "components/dashboard/invoice-amount-input.tsx", "app/(dashboard)/sales/layout.tsx", "app/(dashboard)/sales/loading.tsx", drawerPath]) {
    const ast = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    function visit(n: ts.Node) {
      if (path === drawerPath && ts.isFunctionDeclaration(n) && n.name && !["DrawerFooter", "SectionLabel"].includes(n.name.text)) return;
      if (ts.isJsxText(n)) assert.ok(!/[A-Za-z]/.test(n.text), `${path}: ${n.text}`);
      if (ts.isJsxAttribute(n) && ["placeholder", "aria-label", "title"].includes(n.name.getText(ast)) && n.initializer && ts.isStringLiteral(n.initializer)) assert.ok(!/[A-Za-z]/.test(n.initializer.text), `${path}: ${n.getText(ast)}`);
      ts.forEachChild(n, visit);
    }
    visit(ast);
  }
  for (const namespace of ["SalesNavigation", "DocumentForms"] as const) {
    assert.deepEqual(Object.keys(en[namespace]).sort(), Object.keys(fa[namespace]).sort());
    for (const [key, value] of Object.entries(fa[namespace])) assert.match(value, /[\u0600-\u06ff]/, key);
  }
});
