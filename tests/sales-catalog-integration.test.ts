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
import SalesLayout from "../app/(dashboard)/sales/layout";
import { LineItemsEditor } from "../components/dashboard/line-items-editor";
import { InvoiceAmountInput } from "../components/dashboard/invoice-amount-input";
import * as DatePicker from "../components/ui/date-picker";
import { renderWithPresentation } from "./helpers/presentation";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";

const drawerPath = "components/dashboard/create-drawer.tsx";
const drawers = [
  ["InvoiceDrawer", "SalesInvoices", "createInvoice"],
  ["QuoteDrawer", "SalesQuotes", "createQuote"],
  ["SalesReceiptDrawer", "SalesReceipts", "recordCashSale"],
  ["CreditNoteDrawer", "CreditNotes", "createAction"],
  ["RecurringDrawer", "RecurringInvoices", "createTemplate"],
  ["CustomerCreditDrawer", "CustomerPrepayments", "recordAction"],
  ["RevenueScheduleDrawer", "RevenueSchedules", "create"],
] as const;
const noop = () => {};
const caller = "<script>customer & description</script>";
const id = "11111111-1111-4111-8111-111111111111";
const escaped = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#x27;");
const inline = ({ children }: { children?: ReactNode }) => createElement("div", null, children);

// Keep each production drawer, its chrome and actual shared money controls in
// the same render. Only initial drawer state, effects, navigation, pickers owned
// by other slices and portal contents are controlled. No JSX is reconstructed.
function salesDrawer(name: typeof drawers[number][0], currency: string, price: string, saving: boolean) {
  const ast = ts.createSourceFile(drawerPath, readFileSync(drawerPath, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const names = new Set<string>([name, "DrawerFooter", "DrawerIcon", "SectionLabel"]);
  if (name === "CustomerCreditDrawer") names.add("CustomerCreditForm");
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
    if (ts.isImportDeclaration(n) && n.importClause?.namedBindings && ts.isNamedImports(n.importClause.namedBindings)) {
      const bindings = n.importClause.namedBindings.elements.filter(b => used.has(b.name.text));
      if (bindings.length) return [`import { ${bindings.map(b => b.getText(ast)).join(", ")} } from ${n.moduleSpecifier.getText(ast)};`];
    }
    return [];
  }).join("\n") + `\nexport { ${name} };`;
  source = source.replaceAll('typeof window !== "undefined" ? localStorage.getItem("activeOrgId") : null', '"org-a"');
  const state: Record<string, unknown> = {
    saving, selectedCurrency: currency, currencyCode: currency, contactId: id, bankAccountId: id, invoiceId: id,
    validLines: true, name: caller, notes: caller, reference: caller, amount: price, totalAmount: price,
    date: "2026-10-19", issueDate: "2026-10-19", startDate: "2026-10-19", dueDate: "2026-11-19", expiryDate: "2026-11-19", endDate: "2026-11-19",
    bankAccounts: [{ id, name: caller, currencyCode: currency }],
    invoices: [{ id, invoiceNumber: "INV-001", total: 1250, totalMinor: "1250", currencyCode: "USD" }],
    lines: [{ description: caller, quantity: "1", unitPrice: price, accountId: id, taxRateId: "" }],
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
    if (path.endsWith("/invoice-amount-input")) return { InvoiceAmountInput };
    if (path.endsWith("/ui/date-picker")) return DatePicker;
    if (path.endsWith("/contact-picker")) return { ContactPicker: inline };
    if (path.endsWith("/account-picker")) return { AccountPicker: inline };
    if (path.endsWith("/currency-select")) return { CurrencySelect: inline };
    if (path.endsWith("/ui/sheet") || path.endsWith("/ui/select")) return new Proxy({}, { get: () => inline });
    return require(path.startsWith("@/") ? resolve(path.slice(2)) : path);
  };
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function("require", "module", "exports", code)(load, compiled, compiled.exports);
  return createElement(compiled.exports[name], { open: true, onClose: noop });
}

test("all sales drawers compose with localized shared controls and exact currency previews", () => {
  for (const locale of ["en-US", "fa-IR"] as const) for (const [currency, price] of [["USD", "40000000000000.01"], ["JPY", "4000000000000001"], ["KWD", "4000000000000.001"]]) {
    const messages = locale === "en-US" ? en : fa;
    for (const [name, namespace, action] of drawers) {
      // Revenue schedules retain their existing fixed-two USD contract.
      const amount = name === "RevenueScheduleDrawer" ? "40000000000000.01" : price;
      const html = renderWithPresentation(salesDrawer(name, currency, amount, false), locale);
      const actionLabel: unknown = Reflect.get(messages[namespace], action);
      assert.equal(typeof actionLabel, "string");
      assert.ok(html.includes(escaped(String(actionLabel))), `${name}: action`);
      assert.ok(html.includes(escaped(messages.DocumentForms.cancel)), `${name}: shared cancel`);
      if (name !== "RevenueScheduleDrawer") assert.ok(html.includes(escaped(caller)), `${name}: caller data`);
      if (!["CustomerCreditDrawer", "RevenueScheduleDrawer"].includes(name)) {
        for (const key of ["description", "quantity", "amount", "subtotal", "total", "addLine"] as const) assert.ok(html.includes(escaped(messages.DocumentForms[key])), `${name}: ${key}`);
        assert.ok(html.includes(`>${price}</span>`), `${name}: exact shared preview in ${currency}`);
      }
      assert.ok(!html.includes("<script>") && !html.includes("MISSING_MESSAGE"));
    }
  }
});

test("every sales drawer disables submit and uses current shared or overridden pending copy", () => {
  for (const locale of ["en-US", "fa-IR"] as const) for (const [name] of drawers) {
    const messages = locale === "en-US" ? en : fa;
    const html = renderWithPresentation(salesDrawer(name, "USD", "12.50", true), locale);
    const creating = name === "RevenueScheduleDrawer" ? messages.RevenueSchedules.creating : messages.DocumentForms.creating;
    assert.ok(html.includes(escaped(creating)), name);
    assert.match(html, /<button(?=[^>]*type="submit")(?=[^>]*disabled="")[^>]*>/, name);
    if (locale === "fa-IR") assert.ok(!html.includes(">Cancel<") && !html.includes("Creating..."), name);
  }
});

test("composed line forms localize invalid shared previews and suppress numeric totals", () => {
  for (const locale of ["en-US", "fa-IR"] as const) for (const [name] of drawers.slice(0, 5)) {
    const messages = locale === "en-US" ? en : fa;
    const html = renderWithPresentation(salesDrawer(name, "USD", "not-a-price", false), locale);
    assert.ok(html.includes('role="alert"'), name);
    assert.ok(html.includes(escaped(messages.DocumentForms.priceError)) || html.includes(escaped(messages.DocumentForms.amountError)), name);
    assert.ok(!html.includes(">NaN<"), name);
    assert.match(html, /<span[^>]*>—<\/span>/, name);
    if (locale === "fa-IR") assert.ok(!html.includes("Enter a decimal price"), name);
  }
});

test("sales layout composes the shared invoice form without showing tabs on detail routes", () => {
  for (const locale of ["en-US", "fa-IR"] as const) for (const path of ["/sales", "/sales/invoice-a"]) {
    const messages = locale === "en-US" ? en : fa;
    const html = renderWithPresentation(createElement(PathnameContext.Provider, { value: path }, createElement(SalesLayout, null, salesDrawer("InvoiceDrawer", "USD", "12.50", false))), locale);
    assert.equal(html.includes("<nav"), path === "/sales");
    assert.ok(html.includes(escaped(messages.SalesInvoices.createInvoice)) && html.includes(escaped(messages.DocumentForms.total)));
    if (path === "/sales") assert.ok(html.includes(escaped(messages.SalesNavigation.invoices)));
  }
});

test("combined source inventory covers all sales routes, seven drawers and owned shared controls", () => {
  function files(path: string): string[] {
    return readdirSync(path, { withFileTypes: true }).flatMap(e => e.isDirectory() ? files(`${path}/${e.name}`) : e.name.endsWith(".tsx") ? [`${path}/${e.name}`] : []);
  }
  const routes = files("app/(dashboard)/sales");
  assert.equal(routes.length, 18, "Review added routes in the combined sales inventory");
  const shared = ["line-items-editor", "invoice-amount-input", "receipt-attachments", "quote-money-details", "sales-receipt-money-details", "credit-note-money-details", "customer-prepayment-money-details", "recurring-invoice-money-details"].map(n => `components/dashboard/${n}.tsx`);
  const drawerNames = new Set<string>([...drawers.map(([n]) => n), "CustomerCreditForm", "DrawerFooter", "SectionLabel"]);
  for (const path of [...routes, ...shared, drawerPath]) {
    const ast = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    function visit(n: ts.Node) {
      if (path === drawerPath && n.parent === ast && !(ts.isFunctionDeclaration(n) && n.name && drawerNames.has(n.name.text))) return;
      if (ts.isJsxText(n)) {
        // Child inventories explicitly retain these document-number examples
        // and HTML punctuation entities. Financial illustrations stay numeric.
        const text = n.text.replace(/&(?:middot|ndash|mdash|infin);/g, "").replace(/(?:QTE|INV|SR|CN)-0001|INV-0042/g, "");
        assert.ok(!/[A-Za-z]/.test(text), `${path}: ${n.text.trim()}`);
      }
      if (ts.isJsxAttribute(n) && ["title", "placeholder", "aria-label", "label", "description", "emptyMessage", "alt"].includes(n.name.getText(ast)) && n.initializer && ts.isStringLiteral(n.initializer)) assert.ok(!/[A-Za-z]/.test(n.initializer.text), `${path}: ${n.getText(ast)}`);
      ts.forEachChild(n, visit);
    }
    ts.forEachChild(ast, visit);
  }
});
