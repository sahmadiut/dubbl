import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createElement, type ReactNode } from "react";
import { test } from "node:test";
import ts from "typescript";
import { PathnameContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime";
import AccountingLayout from "../app/(dashboard)/accounting/layout";
import SalesLayout from "../app/(dashboard)/sales/layout";
import PurchasesLayout from "../app/(dashboard)/purchases/layout";
import TaxLayout from "../app/(dashboard)/tax/layout";
import { EntryForm } from "../components/dashboard/entry-form";
import { LineItemsEditor } from "../components/dashboard/line-items-editor";
import { InvoiceAmountInput } from "../components/dashboard/invoice-amount-input";
import { TaxSettlementPreview } from "../components/dashboard/tax-settlement-preview";
import { renderWithPresentation } from "./helpers/presentation";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";

const noop = () => {};
const caller = '<script>\u062d\u0633\u0627\u0628 & caller</script>';
const escape = (s: string) => s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#x27;");
const root = "app/(dashboard)";
const accountId = "11111111-1111-4111-8111-111111111111";
const routes = {
  accounting: ["layout", "loading", "page", "accounts/page", "accounts/[id]/layout", "accounts/[id]/page", "accounts/[id]/settings/page", "[id]/page", "recurring-journals/page", "recurring-journals/[id]/page", "opening-balances/page", "accruals/page", "accruals/[id]/page", "asset-categories/page", "fixed-assets/page", "fixed-assets/[id]/page", "loans/page", "loans/[id]/page", "budgets/page", "budgets/[id]/layout", "budgets/[id]/page", "budgets/[id]/settings/page", "banking/page", "banking/batches/page", "banking/batches/[id]/page", "banking/scheduled/page", "banking/[id]/_components", "banking/[id]/reconcile/page", "banking/[id]/(detail)/layout", "banking/[id]/(detail)/page", "banking/[id]/(detail)/transactions/page", "banking/[id]/(detail)/imports/page", "banking/[id]/(detail)/settings/page"],
  sales: ["layout", "loading", "page", "[id]/page", ...["credit-notes", "customer-prepayments", "payments", "quotes", "receipts", "recurring", "revenue-schedules"].flatMap(p => [`${p}/page`, `${p}/[id]/page`])],
  purchases: ["layout", "loading", "page", "[id]/page", ...["debit-notes", "expenses", "goods-receipts", "landed-costs", "orders", "requisitions"].flatMap(p => [`${p}/page`, `${p}/[id]/page`]), "bills/recurring/page", "expenses/recurring/page"],
  contacts: ["loading", "page", "[id]/layout", "[id]/page", ...["activity", "bookkeeping", "files", "people", "statement"].map(p => `[id]/${p}/page`)],
  tax: ["layout", "page", ...["bas", "currencies", "periods", "sales-tax", "schedule-c", "vat-return", "periods/[id]"].map(p => `${p}/page`)],
};

// Per-file exceptions are technical samples/statutory IDs already recorded by
// the children. No general English-word or document-number exemption is used.
const samples: Record<string, string[]> = {
  "accounting/recurring-journals/page": ["REF-RENT"],
  "sales/credit-notes/page": ["INV-0042", "CN-0001"],
  "sales/customer-prepayments/page": ["INV-0042"],
  "sales/quotes/page": ["QTE-0001", "INV-0001"],
  "sales/receipts/page": ["SR-0001"],
  "purchases/debit-notes/page": ["BILL-0042", "DN-0001"],
  "purchases/goods-receipts/page": ["PO-0042", "GRN-0001"],
  "tax/bas/page": ["G1-G11, 1A-1B"],
};
const placeholders: Record<string, string> = {
  "accounting/banking/[id]/(detail)/settings/page": "US",
  "contacts/[id]/page": "email@example.com",
};
function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? files(`${dir}/${e.name}`) : e.name.endsWith(".tsx") ? [`${dir}/${e.name}`] : []);
}

test("LOC-007 reconciles all 87 current routes and their authored copy across domain boundaries", () => {
  const namespaces = new Set<string>(["JournalActivity", "DocumentForms", "ReceiptAttachments", "ProcurementDetails"]);
  for (const [domain, paths] of Object.entries(routes)) {
    const expected = paths.map(p => `${root}/${domain}/${p}.tsx`).sort();
    assert.deepEqual(files(`${root}/${domain}`).sort(), expected, `${domain}: review added/removed routes`);
    for (const path of expected) {
      const relative = path.slice(root.length + 1, -4);
      const ast = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
      function visit(n: ts.Node) {
        if (ts.isJsxText(n)) {
          let text = n.text.replace(/&(?:rarr|infin|ndash|mdash|middot);/g, "");
          for (const sample of samples[relative] ?? []) text = text.replaceAll(sample, "");
          assert.ok(!/[A-Za-z]/.test(text), `${relative}: uncataloged JSX ${n.text.trim()}`);
        }
        if (ts.isJsxAttribute(n) && ["title", "description", "placeholder", "aria-label", "alt", "label", "emptyMessage"].includes(n.name.getText(ast)) && n.initializer && ts.isStringLiteral(n.initializer)) {
          const text = n.initializer.text;
          const technical = n.name.getText(ast) === "placeholder" && text === placeholders[relative];
          assert.ok(technical || !/[A-Za-z]/.test(text), `${relative}: ${n.getText(ast)}`);
        }
        if (ts.isCallExpression(n) && n.expression.getText(ast) === "useDocumentTitle") assert.ok(!n.arguments.some(ts.isStringLiteral), relative);
        if (ts.isCallExpression(n) && n.expression.getText(ast) === "useTranslations" && n.arguments[0] && ts.isStringLiteral(n.arguments[0])) namespaces.add(n.arguments[0].text);
        ts.forEachChild(n, visit);
      }
      visit(ast);
    }
  }
  assert.equal(Object.values(routes).reduce((count, paths) => count + paths.length, 0), 87);
  assert.equal(namespaces.size, 54, "Review new namespaces against the combined inventory");
  assert.equal([...namespaces].reduce((count, ns) => count + Object.keys((en as Record<string, object>)[ns]).length, 0), 4250);
  for (const ns of namespaces) {
    const english = (en as Record<string, Record<string, string>>)[ns];
    const persian = (fa as Record<string, Record<string, string>>)[ns];
    assert.ok(english && persian, ns);
    assert.deepEqual(Object.keys(english).sort(), Object.keys(persian).sort(), ns);
    for (const [key, value] of Object.entries(persian)) {
      // These are interpolation-only templates; their substituted month/method
      // labels are localized by the production caller, not authored English.
      if (["Budgets.monthLabel", "RevenueSchedules.detailDescription"].includes(`${ns}.${key}`)) assert.equal(value, english[key]);
      else assert.match(value, /[\u0600-\u06ff]/, `${ns}.${key}`);
    }
  }
});

function within(Layout: typeof SalesLayout, path: string, children: ReactNode) {
  return createElement(PathnameContext.Provider, { value: path }, createElement(Layout, null, children));
}

test("accounting, sales, purchasing and tax share the real locale and preserve distinct exact-money entry contracts", () => {
  for (const locale of ["en-US", "fa-IR"] as const) for (const [currency, price] of [["USD", "40000000000000.01"], ["JPY", "4000000000000001"], ["KWD", "4000000000000.001"]] as const) {
    const messages = locale === "en-US" ? en : fa;
    for (const [Layout, path, label, kind] of [
      [SalesLayout, "/sales", messages.SalesNavigation.invoices, "invoice"],
      [SalesLayout, "/sales/recurring", messages.SalesNavigation.recurring, "recurringInvoice"],
      [PurchasesLayout, "/purchases", messages.PurchasingNavigation.bills, "bill"],
      [PurchasesLayout, "/purchases/orders", messages.PurchasingNavigation.purchaseOrders, "purchaseOrder"],
      [PurchasesLayout, "/purchases/bills/recurring", messages.PurchasingNavigation.recurringBills, "recurringBill"],
    ] as const) {
      const html = renderWithPresentation(within(Layout, path, createElement(LineItemsEditor, {
        // Recurring bills retain fixed-two input units even for JPY/KWD.
        lines: [{ description: caller, quantity: "1", unitPrice: kind === "recurringBill" ? "40000000000000.01" : price, accountId, taxRateId: "" }],
        currencyCode: currency, documentKind: kind, taxContext: Layout === SalesLayout ? "sales" : "purchase", onChange: noop,
      })), locale);
      for (const value of [label, messages.DocumentForms.total, messages.DocumentForms.account, caller]) assert.ok(html.includes(escape(value)), `${path}: ${value}`);
      assert.ok(html.includes(`>${price}</span>`), `${kind}/${currency}: low-order digits`);
      assert.ok(html.includes('value="' + escape(caller) + '"'));
      assert.ok(!html.includes("<script>") && !html.includes("MISSING_MESSAGE"));
      const active = html.match(/<a\b[^>]*class="[^"]*border-foreground[^"]*"[^>]*>/g) ?? [];
      assert.equal(active.length, 1, path);
      assert.ok(active[0].includes(`href="${path}"`), path);
    }
    // Journals intentionally retain the existing fixed-two decimal entry bridge;
    // changing presentation language or document currency must not rescale it.
    const html = renderWithPresentation(within(AccountingLayout, "/accounting", createElement(EntryForm, {
      accounts: [{ id: accountId, code: "1000", name: caller }], onSubmit: noop,
      initial: { date: "2026-10-20", description: caller, reference: "REF-001", lines: [
        { accountId, description: caller, debit: "40000000000000.01", credit: "" },
        { accountId, description: caller, debit: "", credit: "40000000000000.01" },
      ] },
    })), locale);
    for (const value of [messages.Accounts.transactions, messages.Journals.debit, caller, "40000000000000.01"]) assert.ok(html.includes(escape(value)), value);
    assert.equal((html.match(/>40000000000000\.01<\/span>/g) ?? []).length, 2, "both journal totals retain low-order digits");
    const tax = renderWithPresentation(within(TaxLayout, "/tax/periods", createElement(TaxSettlementPreview, { amount: price, currency })), locale);
    assert.ok(tax.includes(escape(messages.TaxNavigation.periods)) && tax.includes('role="status"'));
    const [whole, fraction] = price.split(".");
    const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + (fraction ? `.${fraction}` : "");
    assert.ok(tax.includes(grouped), `${currency}: settlement preserves exact low-order digits`);
    assert.ok(!tax.includes("MISSING_MESSAGE"));
  }
});

test("shared invalid amount alerts follow the domain locale and detail routes retain their form content", () => {
  for (const locale of ["en-US", "fa-IR"] as const) for (const [Layout, path] of [[SalesLayout, "/sales/invoice-a"], [PurchasesLayout, "/purchases/bill-a"]] as const) {
    const messages = locale === "en-US" ? en : fa;
    const html = renderWithPresentation(within(Layout, path, createElement(InvoiceAmountInput, { currency: "KWD", value: "invalid", onChange: noop })), locale);
    assert.ok(!html.includes("<nav"), path);
    assert.ok(html.includes('role="alert"') && html.includes('aria-invalid="true"'));
    assert.ok(html.includes(escape(messages.DocumentForms.invalidAmount.replace("{currency}", "KWD"))));
    assert.ok(html.includes('value="invalid"'), "raw entry remains available for correction");
    const tax = renderWithPresentation(within(TaxLayout, "/tax/periods/period-a", createElement(TaxSettlementPreview, { currency: "KWD", amount: "invalid" })), locale);
    assert.ok(!tax.includes("<nav") && tax.includes('role="alert"'));
    assert.ok(tax.includes(escape(messages.TaxPeriods.invalidAmount)));
  }
});
