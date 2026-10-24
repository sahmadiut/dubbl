import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement, type ReactNode } from "react";
import { renderWithPresentation } from "./helpers/presentation";
import { resolvePresentation } from "../i18n/locale";
import { currencyLabel } from "../i18n/currency-labels";
import { bankMoneyDisplay } from "../lib/money/bank-display";
import { assetMoneyDisplay } from "../lib/money/asset-display";
import { expenseMoneyDisplay } from "../lib/money/expense-display";
import { quoteUiSummary } from "../lib/money/quote-ui";
import { paymentUiSummary } from "../lib/money/payment-ui";
import { customerPrepaymentSummary } from "../lib/money/customer-prepayment-ui";
import { salesReceiptUiCollected } from "../lib/money/sales-receipt-ui";
import { procurementOverviewText } from "../lib/money/procurement-ui";
import { journalSideDisplay } from "../lib/money/journal-display";
import { QuoteMoneyDetails } from "../components/dashboard/quote-money-details";
import { CreditNoteMoneyDetails } from "../components/dashboard/credit-note-money-details";
import { DebitNoteMoneyDetails } from "../components/dashboard/debit-note-money-details";
import { SalesReceiptMoneyDetails } from "../components/dashboard/sales-receipt-money-details";
import { ProcurementMoneyDetails } from "../components/dashboard/procurement-money-details";
import { BillCurrencyAmounts } from "../components/dashboard/bill-currency-amounts";
import { PaymentAmountPreview } from "../components/dashboard/payment-amount-preview";
import { InvoiceAmountInput } from "../components/dashboard/invoice-amount-input";
import { RateNote } from "../components/ui/rate-note";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { bankUiTransfer } from "../lib/money/bank-ui";

const locales = ["en-US", "fa-IR"] as const;
const escape = (text: string) => text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
const caller = "<script>& customer</script>";
const amount = 9007199254740991n;

test("actual financial detail templates show language currency names and exact low digits, with escaped caller text", () => {
  for (const language of locales) for (const currencyCode of ["IRR", "USD", "JPY", "KWD"]) {
    const p = resolvePresentation({ user: { language } });
    const line = { id: "line", description: caller, quantity: 125, unitPrice: amount, amount, account: null };
    const doc = { currencyCode, total: amount, subtotal: amount, taxTotal: 0n, lines: [line] };
    const credit = { ...doc, amountApplied: 0n, amountRemaining: amount };
    const nodes: ReactNode[] = [
      createElement(QuoteMoneyDetails, { quote: doc }),
      createElement(CreditNoteMoneyDetails, { credit }),
      createElement(DebitNoteMoneyDetails, { credit }),
      createElement(SalesReceiptMoneyDetails, { receipt: doc }),
      createElement(ProcurementMoneyDetails, { document: doc }),
    ];
    for (const node of nodes) {
      const html = renderWithPresentation(node, language);
      assert.ok(html.includes(escape(bankMoneyDisplay(amount, currencyCode, p))), currencyCode);
      assert.ok(html.includes(escape(caller)) && !html.includes("<script>"));
      if (language === "fa-IR") {
        assert.ok(html.includes(currencyLabel(currencyCode, language)));
        assert.ok(!html.includes(`(${currencyCode})`), html);
      }
    }
    const signed = renderWithPresentation(createElement(BillCurrencyAmounts, { amounts: [{ currencyCode, amount: -amount }] }), language);
    assert.ok(signed.includes(escape(bankMoneyDisplay(-amount, currencyCode, p))));
    assert.equal(doc.currencyCode, currencyCode);
    assert.equal(doc.total, amount);
  }
});

test("grouped summaries localize each saved unit without combining currencies or losing signed amounts", () => {
  for (const language of locales) {
    const p = resolvePresentation({ user: { language } });
    const rows = ["IRR", "KWD"].map(currencyCode => ({ currencyCode, status: "paid", total: amount, amount }));
    const expected = rows.map(r => bankMoneyDisplay(amount, r.currencyCode, p)).join(" · ");
    assert.equal(quoteUiSummary(rows, "paid", p), expected);
    assert.equal(salesReceiptUiCollected(rows, p), expected);
    assert.equal(procurementOverviewText(rows, undefined, p), expected);
    assert.equal(paymentUiSummary(rows, p).total, expected);
    assert.equal(customerPrepaymentSummary(rows.map(r => ({ ...r, status: "active", originalAmount: amount, amountRemaining: amount })), p).received, expected);
    assert.equal(journalSideDisplay([{ currencyCode: "IRR", debitAmountMinor: "0", creditAmountMinor: String(amount) }], "difference", p), bankMoneyDisplay(amount, "IRR", p));
    assert.equal(assetMoneyDisplay(-1n, p), bankMoneyDisplay(-1n, "USD", p));
    assert.equal(assetMoneyDisplay(18446744073709551614n, p).includes(language === "fa-IR" ? currencyLabel("USD", language) : "$"), true);
    assert.equal(expenseMoneyDisplay(123456789n, "IRR", p), bankMoneyDisplay(123456789n, "IRR", p));
    assert.throws(() => expenseMoneyDisplay(-1n, "IRR", p));
  }
});

test("actual payment/input/rate labels display literal Persian rial with the preferred digit display", () => {
  for (const language of locales) {
    const input = renderWithPresentation(createElement(InvoiceAmountInput, { currency: "IRR", value: "123456789", onChange: () => {} }), language);
    assert.ok(input.includes(language === "fa-IR" ? "ریال" : "IRR"));
    assert.ok(input.includes(`value="${language === "fa-IR" ? "۱۲۳۴۵۶۷۸۹" : "123456789"}"`));
    const invalid = renderWithPresentation(createElement(InvoiceAmountInput, { currency: "IRR", value: "1.1", onChange: () => {} }), language);
    assert.match(invalid, /role="alert"/);
    assert.ok(invalid.includes(language === "fa-IR" ? "ریال" : "IRR"));
    const preview = renderWithPresentation(createElement(PaymentAmountPreview, { text: "123456789", bill: { id: "bill", contactId: "contact", currencyCode: "IRR", amountDue: amount } }), language);
    assert.ok(preview.includes(language === "fa-IR" ? "ریال" : "IRR"));
    const rate = renderWithPresentation(createElement(RateNote, { currency: "USD", baseCurrency: "IRR", status: { rate: null, origin: null, effectiveDate: null, ageDays: null, stale: false, missing: true } }), language);
    assert.ok(rate.includes(language === "fa-IR" ? "ریال" : "IRR"));
  }
});

test("authored transfer submit callback keeps canonical ISO and minor payloads", async () => {
  const ast = ts.createSourceFile("drawer.tsx", readFileSync("components/dashboard/create-drawer.tsx", "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const drawer = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === "BankTransferDrawer") as ts.FunctionDeclaration;
  const handler = drawer.body!.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === "handleSubmit")!;
  for (const language of locales) {
    const payloads: Record<string, unknown>[] = [];
    const noop = () => {};
    const scope = { bankAccounts: [{ id: "from", currencyCode: "IRR" }, { id: "to", currencyCode: "IRR" }],
      fromBankAccountId: "from", toBankAccountId: "to", amount: "123456789", date: "2026-10-24", memo: caller,
      localStorage: { getItem: () => "org" }, bankUiTransfer, setSaving: noop, t: (key: string) => `${language}:${key}`, errors: {},
      paymentFailure: (error: unknown) => String(error), requirePaymentResponse: async () => {},
      toast: { error: (message: string) => assert.fail(message), success: noop },
      fetch: async (_url: string, init: RequestInit) => { payloads.push(JSON.parse(init.body as string)); return Response.json({}); },
      onClose: noop, router: { refresh: noop, push: noop },
    };
    const js = ts.transpileModule(`const run = (${handler.getText(ast)});`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
    const submit = new Function(...Object.keys(scope), `${js}; return run;`)(...Object.values(scope));
    await submit({ preventDefault: noop });
    assert.equal(payloads[0].amountMinor, "123456789");
    assert.equal(payloads[0].fromBankAccountId, "from");
    assert.equal(payloads[0].toBankAccountId, "to");
    assert.equal(scope.bankAccounts[0].currencyCode, "IRR");
  }
});
