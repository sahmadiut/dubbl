import { displayNumberFixture } from "./helpers/localized-fixtures";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { test } from "node:test";
import * as React from "react";
import { createElement, type ComponentType, type ReactNode } from "react";
import * as nextIntl from "next-intl";
import ts from "typescript";
import { PathnameContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime";
import PurchasesLayout from "../app/(dashboard)/purchases/layout";
import { LineItemsEditor } from "../components/dashboard/line-items-editor";
import { ExpenseAmountInput } from "../components/dashboard/expense-amount-input";
import * as DatePicker from "../components/ui/date-picker";
import { renderWithPresentation } from "./helpers/presentation";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";

const drawerPath = "components/dashboard/create-drawer.tsx";
const drawers = [
  ["BillDrawer", "SupplierBills", "createBill"],
  ["PurchaseOrderDrawer", "PurchaseOrders", "createOrder"],
  ["DebitNoteDrawer", "DebitNotes", "createAction"],
  ["ExpenseDrawer", "Expenses", "createClaim"],
] as const;
const noop = () => {};
const caller = "<script>supplier & description</script>";
const id = "11111111-1111-4111-8111-111111111111";
const escaped = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#x27;");
const inline = ({ children }: { children?: ReactNode }) => createElement("div", null, children);

// Execute original drawer JSX together with the real shared controls and money
// calculators. Initial state, effects, navigation, adjacent pickers/uploaders
// and portals are controlled; these checks do not mount browser interactions.
function purchasingDrawer(name: typeof drawers[number][0], currency: string, price: string, saving: boolean, overrides: Record<string, unknown> = {}) {
  const ast = ts.createSourceFile(drawerPath, readFileSync(drawerPath, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const names = new Set<string>([name, "DrawerFooter", "DrawerIcon", "SectionLabel"]);
  const functions = ast.statements.filter(n => ts.isFunctionDeclaration(n) && n.name && names.has(n.name.text));
  const stateNames: string[] = [];
  const used = new Set<string>();
  function inspect(n: ts.Node) {
    if (ts.isIdentifier(n)) used.add(n.text);
    if (ts.isVariableDeclaration(n) && ts.isArrayBindingPattern(n.name) && n.initializer && ts.isCallExpression(n.initializer) && n.initializer.expression.getText(ast) === "useState") stateNames.push(n.name.elements[0].getText(ast));
    ts.forEachChild(n, inspect);
  }
  functions.forEach(inspect);
  let source = ast.statements.flatMap(n => {
    if (functions.includes(n)) return [n.getText(ast)];
    if (name === "ExpenseDrawer" && ts.isVariableStatement(n) && n.declarationList.declarations.some(d => d.name.getText(ast) === "emptyExpenseItem")) return [n.getText(ast)];
    if (ts.isImportDeclaration(n) && n.importClause?.namedBindings && ts.isNamedImports(n.importClause.namedBindings)) {
      const bindings = n.importClause.namedBindings.elements.filter(b => used.has(b.name.text));
      if (bindings.length) return [`import { ${bindings.map(b => b.getText(ast)).join(", ")} } from ${n.moduleSpecifier.getText(ast)};`];
    }
    return [];
  }).join("\n") + `\nexport { ${name} };`;
  source = source.replaceAll('typeof window !== "undefined" ? localStorage.getItem("activeOrgId") : null', '"org-a"');
  const state: Record<string, unknown> = {
    saving, selectedCurrency: currency, currencyCode: currency, contactId: id, validLines: true,
    notes: caller, reference: caller, billNumber: caller, title: caller, description: caller,
    issueDate: "2026-10-19", dueDate: "2026-11-19", deliveryDate: "2026-11-19",
    settings: { currencyCode: currency, rate: "1" },
    items: [{ date: "2026-10-19", description: caller, amount: price, category: caller, accountId: id, taxRateId: "", receiptFileKey: "", receiptFileName: "", isMileage: false, distanceMiles: "", mileageRate: "" }],
    lines: [{ description: caller, quantity: "1", unitPrice: price, accountId: id, taxRateId: "" }],
    ...overrides,
  };
  let index = 0;
  const require = createRequire(resolve(drawerPath));
  const compiled = { exports: {} as Record<string, ComponentType<Record<string, unknown>>> };
  const load = (path: string): unknown => {
    if (path === "react") return { ...React, useState: (initial: unknown) => {
      const key = stateNames[index++];
      return [Object.hasOwn(state, key) ? state[key] : typeof initial === "function" ? initial() : initial, noop];
    }, useEffect: noop, useRef: (value: unknown) => ({ current: value }) };
    if (path === "next-intl") return nextIntl;
    if (path === "next/navigation") return { useRouter: () => ({ push: noop }) };
    if (path.endsWith("/line-items-editor")) return { LineItemsEditor };
    if (path.endsWith("/expense-amount-input")) return { ExpenseAmountInput };
    if (path.endsWith("/ui/date-picker")) return DatePicker;
    if (path.endsWith("/contact-picker")) return { ContactPicker: inline };
    if (path.endsWith("/account-picker")) return { AccountPicker: inline };
    if (path.endsWith("/currency-select")) return { CurrencySelect: inline };
    if (path.endsWith("/file-uploader")) return { FileUploader: inline };
    if (path.endsWith("/ui/sheet") || path.endsWith("/ui/select")) return new Proxy({}, { get: () => inline });
    return require(path.startsWith("@/") ? resolve(path.slice(2)) : path);
  };
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function("require", "module", "exports", code)(load, compiled, compiled.exports);
  return createElement(compiled.exports[name], { open: true, onClose: noop });
}

test("purchasing drawers compose with localized shared controls and exact currency previews", () => {
  for (const locale of ["en-US", "fa-IR"] as const) for (const [currency, price] of [["USD", "40000000000000.01"], ["JPY", "4000000000000001"], ["KWD", "4000000000000.001"]]) {
    const messages = locale === "en-US" ? en : fa;
    for (const [name, namespace, action] of drawers) {
      const html = renderWithPresentation(purchasingDrawer(name, currency, price, false), locale);
      const label: unknown = Reflect.get(messages[namespace], action);
      assert.equal(typeof label, "string");
      assert.ok(html.includes(escaped(String(label))), `${name}: action`);
      assert.ok(html.includes(escaped(messages.DocumentForms.cancel)), `${name}: cancel`);
      assert.ok(html.includes(escaped(caller)) && !html.includes("<script>"), name);
      assert.ok(!html.includes("MISSING_MESSAGE"), name);
      if (name === "ExpenseDrawer") {
        assert.ok(html.includes(`value="${displayNumberFixture(price, locale)}"`), `${name}: exact input`);
        const [whole, fraction] = price.split(".");
        const display = `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}${fraction ? `.${fraction}` : ""}`;
        assert.ok(html.includes(displayNumberFixture(display, locale)), `${name}: exact total ${display}`);
      } else {
        for (const key of ["description", "quantity", "amount", "subtotal", "total", "addLine"] as const) assert.ok(html.includes(escaped(messages.DocumentForms[key])), `${name}: ${key}`);
        assert.ok(html.includes(`>${price}</span>`), `${name}: exact preview in ${currency}`);
      }
      assert.doesNotMatch(html, /<button(?=[^>]*type="submit")(?=[^>]*disabled="")[^>]*>/, `${name}: valid submission`);
    }
  }
});

test("purchasing drawers render localized pending footers and disable submission", () => {
  for (const locale of ["en-US", "fa-IR"] as const) for (const [name] of drawers) {
    const messages = locale === "en-US" ? en : fa;
    const pending = name === "BillDrawer" ? messages.DocumentForms.creating : name === "PurchaseOrderDrawer" ? messages.PurchaseOrders.saving : name === "DebitNoteDrawer" ? messages.DebitNotes.creating : messages.Expenses.creating;
    const html = renderWithPresentation(purchasingDrawer(name, "USD", "12.50", true), locale);
    assert.ok(html.includes(escaped(pending)), name);
    assert.match(html, /<button(?=[^>]*type="submit")(?=[^>]*disabled="")[^>]*>/, name);
    if (locale === "fa-IR") assert.ok(!html.includes(">Cancel<") && !html.includes("Creating..."), name);
  }
});

test("composed purchasing forms translate invalid previews and suppress numeric totals", () => {
  for (const locale of ["en-US", "fa-IR"] as const) for (const [name] of drawers) {
    const messages = locale === "en-US" ? en : fa;
    const html = renderWithPresentation(purchasingDrawer(name, "USD", "invalid-price", false), locale);
    assert.ok(html.includes('role="alert"'), name);
    const error = name === "ExpenseDrawer" ? messages.Expenses.decimalError : messages.DocumentForms.priceError;
    assert.ok(html.includes(escaped(error)), `${name}: reviewed failure`);
    assert.match(html, /<span[^>]*>\u2014<\/span>/, name);
    assert.ok(!html.includes(">NaN<"), name);
  }
});

test("bill shared footer blocks unresolved supplier currency and invalid line state", () => {
  for (const locale of ["en-US", "fa-IR"] as const) for (const overrides of [{ selectedCurrency: "", currencyContext: null }, { validLines: false }, { contactId: "" }]) {
    const html = renderWithPresentation(purchasingDrawer("BillDrawer", "USD", "12.50", false, overrides), locale);
    assert.match(html, /<button(?=[^>]*type="submit")(?=[^>]*disabled="")[^>]*>/);
  }
});

test("purchasing layout composes a real bill form on list and detail routes", () => {
  for (const locale of ["en-US", "fa-IR"] as const) for (const path of ["/purchases", "/purchases/bill-a"]) {
    const messages = locale === "en-US" ? en : fa;
    const html = renderWithPresentation(createElement(PathnameContext.Provider, { value: path }, createElement(PurchasesLayout, null, purchasingDrawer("BillDrawer", "USD", "12.50", false))), locale);
    assert.equal(html.includes("<nav"), path === "/purchases");
    assert.ok(html.includes(escaped(messages.SupplierBills.createBill)) && html.includes(escaped(messages.DocumentForms.total)));
    if (path === "/purchases") assert.ok(html.includes(escaped(messages.PurchasingNavigation.bills)));
  }
});

test("combined inventory audits all purchasing routes, four drawers and shared controls", () => {
  function files(path: string): string[] {
    return readdirSync(path, { withFileTypes: true }).flatMap(e => e.isDirectory() ? files(`${path}/${e.name}`) : e.name.endsWith(".tsx") ? [`${path}/${e.name}`] : []);
  }
  const routes = files("app/(dashboard)/purchases");
  assert.equal(routes.length, 18, "Review added routes in the combined purchasing inventory");
  const shared = ["line-items-editor", "invoice-amount-input", "expense-amount-input", "bill-currency-amounts", "requisition-line-editor", "procurement-money-details", "debit-note-money-details", "debit-note-overview"].map(n => `components/dashboard/${n}.tsx`);
  const drawerNames = new Set<string>([...drawers.map(([n]) => n), "DrawerFooter", "SectionLabel"]);
  for (const path of [...routes, ...shared, drawerPath]) {
    const ast = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    function visit(n: ts.Node) {
      if (path === drawerPath && n.parent === ast && !(ts.isFunctionDeclaration(n) && n.name && drawerNames.has(n.name.text))) return;
      if (ts.isJsxText(n)) {
        // Fixed document identifiers and punctuation are documented examples.
        const text = n.text.replace(/&(?:middot|ndash|mdash|infin);/g, "").replace(/(?:PO|BILL)-0042|(?:GRN|DN)-0001/g, "");
        assert.ok(!/[A-Za-z]/.test(text), `${path}: ${n.text.trim()}`);
      }
      if (ts.isJsxAttribute(n) && ["title", "placeholder", "aria-label", "label", "description", "emptyMessage", "alt"].includes(n.name.getText(ast)) && n.initializer && ts.isStringLiteral(n.initializer)) assert.ok(!/[A-Za-z]/.test(n.initializer.text), `${path}: ${n.getText(ast)}`);
      ts.forEachChild(n, visit);
    }
    ts.forEachChild(ast, visit);
  }
});
