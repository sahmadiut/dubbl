import { currencyFixture } from "./helpers/localized-fixtures";
import { resolvePresentation } from "../i18n/locale";
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { createElement, isValidElement, type ComponentType, type ReactNode, type ReactElement } from "react";
import * as React from "react";
import * as nextIntl from "next-intl";
import { createTranslator } from "next-intl";
import ts from "typescript";
import * as Select from "../components/ui/select";
import { CurrencySelect } from "../components/ui/currency-select";
import { LineItemsEditor } from "../components/dashboard/line-items-editor";
import { recurringBillFrequencyLabel, recurringBillStatusLabel, recurringBillInputError } from "../i18n/recurring-bill-presentation";
import { recurringBillEditorPayload, recurringBillUiDocument, recurringBillEditorPreview } from "../lib/money/recurring-bill-ui";
import { invoiceUiMoney } from "../lib/money/invoice-ui";
import { renderWithPresentation } from "./helpers/presentation";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";

const path = "app/(dashboard)/purchases/bills/recurring/page.tsx";
const locales = ["en-US", "fa-IR"] as const;
const noop = () => {};
const caller = "<script>تأمین‌کننده & recurring</script>";
const supplierId = "00000000-0000-4000-8000-000000000001";
const raw = { id: "template-a", name: caller, type: "bill", frequency: "monthly", status: "active", currencyCode: "USD", nextRunDate: "2026-11-19", reference: caller, contact: { name: caller },
  lines: [{ id: "line-a", description: caller, quantity: 100, discountPercent: 1000, unitPrice: 9007199254740991, unitPriceMinor: "9007199254740991" }] };
const saved = recurringBillUiDocument(raw);
const line = { description: caller, quantity: "1", unitPrice: "12.50", accountId: "", taxRateId: "" };
const header = { name: ` ${caller} `, contactId: supplierId, frequency: "monthly", startDate: "2026-10-19", endDate: "", maxOccurrences: "", reference: caller, currencyCode: "USD" };
function translator(locale: typeof locales[number]) { return createTranslator({ locale, messages: locale === "en-US" ? en : fa, namespace: "RecurringBills" }); }
function escape(value: string) { return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#x27;"); }
function parse() { return ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX); }

// Execute the actual workspace with controlled state/effects and a visible
// sheet boundary. Table, selectors, line editor, money and next-intl are real.
function loaded(states: Record<string, unknown> = {}, events: unknown[] = [], inspect: (tree: ReactElement) => void = noop) {
  const ast = parse(), names: string[] = [];
  function hooks(node: ts.Node) {
    if (ts.isVariableDeclaration(node) && ts.isArrayBindingPattern(node.name) && node.initializer && ts.isCallExpression(node.initializer) && node.initializer.expression.getText(ast) === "useState") names.push(node.name.elements[0].getText(ast));
    ts.forEachChild(node, hooks);
  }
  hooks(ast);
  const require = createRequire(resolve(path)), compiled = { exports: {} as { RecurringBillsWorkspace: ComponentType<{ orgId: string }> } };
  let index = 0;
  const inline = ({ children }: { children: ReactNode }) => createElement("div", null, children);
  const load = (id: string) => {
    if (id === "react") return { ...React, useState: (initial: unknown) => {
      const key = names[index++];
      return [Object.hasOwn(states, key) ? states[key] : typeof initial === "function" ? initial() : initial,
        (value: unknown) => events.push([key, typeof value === "function" ? value(states[key]) : value])];
    }, useEffect: noop, useCallback: (fn: unknown) => fn };
    if (id === "next-intl") return nextIntl;
    if (id.endsWith("/ui/select")) return Select;
    if (id.endsWith("/use-document-title")) return { useDocumentTitle: (value: string) => events.push(["title", value]) };
    if (id.endsWith("/ui/sheet")) return Object.fromEntries(["Sheet", "SheetContent", "SheetHeader", "SheetTitle"].map(key => [key, inline]));
    if (id.endsWith("/contact-picker")) return { ContactPicker: ({ placeholder }: { placeholder: string }) => createElement("span", null, placeholder) };
    if (id.endsWith("/line-items-editor")) return { LineItemsEditor };
    if (id.endsWith("/currency-select")) return { CurrencySelect };
    return require(id.startsWith("@/") ? resolve(id.slice(2)) : id);
  };
  const code = ts.transpileModule(ast.text + "\nexport { RecurringBillsWorkspace };", { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function("require", "module", "exports", code)(load, compiled, compiled.exports);
  return function Probe() {
    const tree = (compiled.exports.RecurringBillsWorkspace as (props: { orgId: string }) => ReactElement)({ orgId: "org-a" });
    inspect(tree);
    return tree;
  };
}

function nodes(tree: ReactNode): ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  if (!isValidElement<Record<string, unknown>>(tree)) return [];
  return [tree, ...nodes(tree.props.children as ReactNode)];
}

// Execute original callback syntax; request handlers and money are not mocked.
function callback(name: string, scope: Record<string, unknown>) {
  const ast = parse(); let expression = "";
  function visit(node: ts.Node) {
    if (name === "effect" && ts.isCallExpression(node) && node.expression.getText(ast) === "useEffect") expression = node.arguments[0].getText(ast);
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === name && node.initializer) expression = node.initializer.getText(ast);
    ts.forEachChild(node, visit);
  }
  visit(ast); assert.ok(expression, name);
  const code = ts.transpileModule(`const run = ${expression};`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  return new Function(...Object.keys(scope), `${code}; return run;`)(...Object.values(scope));
}
const flush = async () => { for (let i = 0; i < 4; i++) await new Promise(resolve => setImmediate(resolve)); };

test("recurring bill workspace renders bilingual guidance, states, exact currency rows and escaped saved data", () => {
  for (const locale of locales) {
    const t = translator(locale), events: unknown[] = [];
    const Empty = loaded({ loading: false }, events);
    const empty = renderWithPresentation(createElement(Empty), locale);
    for (const key of ["title", "description", "newBill", "name", "supplier", "frequency", "nextBill", "status", "currency", "grossAmount", "empty"] as const) assert.ok(empty.includes(escape(t(key))), key);
    assert.deepEqual(events, [["title", t("documentTitle")]]);
    const rows = [saved, { ...saved, id: "template-b", currencyCode: "KWD", frequency: "semi_annual", status: "paused", lines: [{ ...saved.lines[0], grossMinor: 1n }] },
      { ...saved, id: "template-c", currencyCode: "JPY", frequency: "fortnightly", status: "completed", nextRunDate: null, contact: null, lines: [{ ...saved.lines[0], grossMinor: 1250n }] },
      { ...saved, id: "template-d", frequency: "__proto__", status: "constructor" }];
    const Page = loaded({ loading: false, templates: rows });
    const html = renderWithPresentation(createElement(Page), locale);
    for (const key of ["monthly", "semiAnnual", "fortnightly", "active", "paused", "completed"] as const) assert.ok(html.includes(escape(t(key))), key);
    for (const [amount, currency] of [[9007199254740991n, "USD"], [1n, "KWD"], [1250n, "JPY"]] as const) assert.ok(html.includes(escape(invoiceUiMoney(amount, currency, resolvePresentation({ user: { language: locale } })))));
    assert.ok(html.includes(escape(caller)) && !html.includes("<script>") && html.includes("__proto__") && html.includes("constructor"));
    assert.ok(html.includes(raw.nextRunDate));
    const Loading = loaded();
    assert.ok(renderWithPresentation(createElement(Loading), locale).includes(escape(t("loading"))));
    for (const error of ["readFailed", "checkAmounts", "createFailed", "checkDetails", "occurrenceLimit", "lineDescription", "dateOrder", "priceError", "quantityError", "lineCountError"] as const) {
      const Failed = loaded({ loading: false, error });
      const failed = renderWithPresentation(createElement(Failed), locale);
      assert.ok(failed.includes('role="alert"') && failed.includes(escape(t(error))), error);
    }
  }
});

test("recurring bill drawer uses real fixed-two preview and localized frequency trigger while preserving option values and callbacks", () => {
  for (const locale of locales) for (const currencyCode of ["USD", "JPY", "KWD", "IRR"]) {
    const t = translator(locale), events: unknown[] = [], captured: ReactElement[] = [];
    const Drawer = loaded({ drawerOpen: true, loading: false, name: caller, contactId: supplierId, reference: caller, startDate: "2026-10-19", lines: [line], currencyCode, validLines: true }, events, tree => captured.push(tree));
    const html = renderWithPresentation(createElement(Drawer), locale);
    for (const key of ["newBill", "namePlaceholder", "supplierPlaceholder", "reference", "referencePlaceholder", "startDate", "endDate", "maxOccurrences", "unlimited", "create", "monthly"] as const) assert.ok(html.includes(escape(t(key))), key);
    const forms = createTranslator({ locale, messages: locale === "en-US" ? en : fa, namespace: "DocumentForms" });
    assert.ok(html.includes(escape(forms("recurringBillScale", { currency: currencyFixture(currencyCode, locale) }))));
    assert.ok(html.includes(escape(forms("priceFixedScale"))) && html.includes(escape(caller)) && !html.includes("<script>"));
    const expected = { USD: "12.50", JPY: "1250", KWD: "1.250", IRR: "1250" }[currencyCode];
    assert.ok(html.includes(`${expected}</span>`), currencyCode);
    const elements = nodes(captured[0]);
    const options = elements.filter(element => element.type === Select.SelectItem);
    assert.deepEqual(options.map(element => element.props.value), ["weekly", "fortnightly", "monthly", "quarterly", "semi_annual", "annual"]);
    assert.deepEqual(options.map(element => element.props.children), (["weekly", "fortnightly", "monthly", "quarterly", "semiAnnual", "annual"] as const).map(key => t(key)));
    const frequency = elements.find(element => element.type === Select.Select)!;
    (frequency.props.onValueChange as (v: string) => void)("quarterly");
    assert.deepEqual(events.at(-1), ["frequency", "quarterly"]);
    const currency = elements.find(element => element.type === CurrencySelect)!;
    (currency.props.onValueChange as (v: string) => void)("KWD");
    assert.deepEqual(events.slice(-2), [["currencyCode", "KWD"], ["validLines", false]]);
    const editor = elements.find(element => element.type === LineItemsEditor)!;
    assert.equal(editor.props.documentKind, "recurringBill"); assert.equal(editor.props.priceFractionDigits, 18);
    (editor.props.onChange as (v: unknown) => void)([{ ...line, unitPrice: "0.005" }]);
    assert.deepEqual(events.slice(-2), [["lines", [{ ...line, unitPrice: "0.005" }]], ["validLines", false]]);
    assert.equal(recurringBillEditorPreview([{ ...line, unitPrice: "0.005", quantity: "3" }], currencyCode, []).total, 3n);
  }
  const Busy = loaded({ drawerOpen: true, submitting: true });
  const busy = renderWithPresentation(createElement(Busy), "fa-IR");
  assert.ok(busy.includes(escape(translator("fa-IR")("creating"))));
  assert.match(busy, /<button(?=[^>]*disabled="")[^>]*>/);
});

test("recurring bill read effect keeps org/type and money contracts, localizes failures and rejects cancelled work", async () => {
  for (const mode of ["success", "status", "network", "html", "shape", "alias", "stale"]) {
    const errors: unknown[] = [], writes: unknown[] = [], busy: boolean[] = [];
    const cleanup = callback("effect", { orgId: "org-a", orgHeaders: () => ({ "x-organization-id": "org-a" }), recurringBillUiDocument,
      setLoading: (v: boolean) => busy.push(v), setError: (v: unknown) => errors.push(v), setTemplates: (v: unknown) => writes.push(v),
      fetch: async (url: string, init: RequestInit) => {
        assert.equal(url, "/api/v1/recurring?type=bill"); assert.equal((init.headers as Record<string, string>)["x-organization-id"], "org-a");
        if (mode === "network") throw new Error("private server prose");
        if (mode === "html") return new Response("private HTML");
        return Response.json(mode === "shape" ? {} : { data: [{ ...raw, lines: [{ ...raw.lines[0], unitPriceMinor: mode === "alias" ? "09007199254740991" : raw.lines[0].unitPriceMinor }] }] }, { status: mode === "status" ? 403 : 200 });
      } })();
    if (mode === "stale") cleanup();
    await flush();
    assert.deepEqual(writes, mode === "success" ? [[saved]] : mode === "stale" ? [] : [[]]);
    assert.deepEqual(errors, ["success", "stale"].includes(mode) ? [null] : [null, "readFailed"]);
    assert.deepEqual(busy, mode === "stale" ? [true] : [true, false]);
    cleanup();
  }
  callback("effect", { orgId: "", fetch: () => assert.fail("missing org must not fetch") })();
});

test("recurring bill create callback retains exact payloads/defaults, reports local validation and keeps failed forms open", async () => {
  for (const mode of ["success", "limited", "status", "network", "html", "shape", "limit", "dateOrder", "description", "schema", "amount", "invalidPrice", "invalidQuantity"]) {
    const errors: unknown[] = [], busy: boolean[] = [], closed: boolean[] = [], requests: RequestInit[] = [];
    let resets = 0, reloads = 0;
    const currentHeader = { ...header, ...(mode === "limited" ? { currencyCode: "KWD", frequency: "semi_annual", maxOccurrences: "2", endDate: "2027-10-19" } : {}), ...(mode === "limit" ? { maxOccurrences: "1.5" } : {}), ...(mode === "dateOrder" ? { endDate: "2026-01-01" } : {}), ...(mode === "schema" ? { contactId: "invalid" } : {}) };
    const currentLines = [{ ...line, unitPrice: mode === "invalidPrice" ? "1x" : "0.005", quantity: mode === "invalidQuantity" ? "NaN" : "3", ...(mode === "description" ? { description: " " } : {}) }];
    await callback("handleSubmit", { ...currentHeader, orgId: "org-a", submitting: false, lines: currentLines, validLines: mode !== "amount", recurringBillEditorPayload, recurringBillInputError,
      orgHeaders: () => ({ "x-organization-id": "org-a" }), setError: (v: unknown) => errors.push(v), setSubmitting: (v: boolean) => busy.push(v), setDrawerOpen: (v: boolean) => closed.push(v),
      resetForm: () => resets++, setReload: (fn: (v: number) => number) => { reloads = fn(0); },
      fetch: async (url: string, init: RequestInit) => {
        assert.equal(url, "/api/v1/recurring"); requests.push(init);
        if (mode === "network") throw new Error("private server prose");
        if (mode === "html") return new Response("private HTML");
        return Response.json(mode === "shape" ? { template: {} } : { template: { id: "new-template" }, error: "private server prose" }, { status: mode === "status" ? 403 : 201 });
      } })();
    const localError = { limit: "occurrenceLimit", dateOrder: "dateOrder", description: "lineDescription", schema: "checkDetails", amount: "checkAmounts", invalidPrice: "priceError", invalidQuantity: "quantityError" }[mode];
    const success = ["success", "limited"].includes(mode);
    assert.deepEqual(errors, localError ? [localError] : success ? [null] : [null, "createFailed"]);
    assert.deepEqual(busy, localError ? [] : [true, false]);
    assert.deepEqual(closed, success ? [false] : []); assert.equal(resets, success ? 1 : 0); assert.equal(reloads, success ? 1 : 0);
    assert.equal(requests.length, localError ? 0 : 1);
    if (!localError) {
      assert.equal(requests[0].method, "POST"); assert.deepEqual(requests[0].headers, { "Content-Type": "application/json", "x-organization-id": "org-a" });
      const body = JSON.parse(String(requests[0].body));
      assert.deepEqual(body, recurringBillEditorPayload(currentHeader, currentLines));
      assert.equal(body.lines[0].unitPriceExact, "0.005"); assert.equal(body.lines[0].quantity, 3); assert.equal(body.type, "bill");
      assert.equal(body.name, caller); assert.equal(body.reference, caller);
      if (mode === "success") { assert.equal(body.currencyCode, "USD"); assert.equal(body.endDate, null); assert.equal(body.maxOccurrences, null); }
    }
  }
  for (const extra of [{ orgId: "" }, { submitting: true }, { name: "" }, { contactId: "" }, { startDate: "" }, { lines: [] }]) await callback("handleSubmit", { ...header, orgId: "org-a", submitting: false, lines: [line], ...extra, fetch: () => assert.fail("guard must stop fetch") })();
});

test("recurring bill reset retains original defaults; finite labels/errors and source inventory are safe", () => {
  const events: unknown[] = [];
  const setters = Object.fromEntries(["Name", "ContactId", "Frequency", "StartDate", "EndDate", "MaxOccurrences", "Reference", "Lines", "CurrencyCode", "ValidLines", "Error"].map(name => [`set${name}`, (value: unknown) => events.push([name, value])]));
  callback("resetForm", { ...setters, emptyLine: () => ({ description: "", quantity: "1", unitPrice: "", accountId: "", taxRateId: "" }) })();
  assert.deepEqual(events, [["Name", ""], ["ContactId", ""], ["Frequency", "monthly"], ["StartDate", ""], ["EndDate", ""], ["MaxOccurrences", ""], ["Reference", ""], ["Lines", [{ description: "", quantity: "1", unitPrice: "", accountId: "", taxRateId: "" }]], ["CurrencyCode", "USD"], ["ValidLines", false], ["Error", null]]);
  for (const locale of locales) {
    const t = translator(locale);
    for (const code of ["future_code", "__proto__", "constructor"]) {
      assert.equal(recurringBillFrequencyLabel(t, code), code); assert.equal(recurringBillStatusLabel(t, code), code);
    }
  }
  for (const input of [null, "server prose", new Error("private details"), new Error("__proto__")]) assert.equal(recurringBillInputError(input), "checkDetails");
  for (const value of Object.values(fa.RecurringBills)) assert.match(value, /[\u0600-\u06ff]/);
  const ast = parse();
  function visit(node: ts.Node) {
    if (ts.isJsxText(node)) assert.doesNotMatch(node.text.trim(), /[A-Za-z]/, node.text);
    if (ts.isJsxAttribute(node) && ["title", "label", "description", "placeholder", "aria-label", "emptyMessage"].includes(node.name.getText(ast)) && node.initializer && ts.isStringLiteral(node.initializer)) assert.doesNotMatch(node.initializer.text, /[A-Za-z]/);
    ts.forEachChild(node, visit);
  }
  visit(ast);
});
