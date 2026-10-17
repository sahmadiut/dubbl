import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { createElement } from "react";
import { renderToStaticMarkup } from "./helpers/presentation";
import { creditNoteEditorLines, creditNoteUiHeader, creditNoteUiDocument, creditNoteUiSummary, creditNoteUiInvoice,
  creditNoteUiApplication, creditNoteUiInvoiceEligible, creditNoteUiMoney } from "../lib/money/credit-note-ui";
import { documentEditorPreview } from "../lib/money/document-editor";
import { creditCreateFields, creditMcpCreateFields, creditTotals, creditApplyFields, creditAmount } from "../lib/api/credit-wire";
import { CreditNoteMoneyDetails } from "../components/dashboard/credit-note-money-details";
import { LineItemsEditor } from "../components/dashboard/line-items-editor";
import { InvoiceAmountInput } from "../components/dashboard/invoice-amount-input";

const line = (unitPrice = "12.50", quantity = "1") => ({ description: "Work", quantity, unitPrice, accountId: "", taxRateId: "" });
const header = (currencyCode = "USD", value = 1250) => ({ currencyCode, subtotal: value, subtotalMinor: String(value), taxTotal: 0,
  taxTotalMinor: "0", total: value, totalMinor: String(value), amountApplied: 0, amountAppliedMinor: "0", amountRemaining: value, amountRemainingMinor: String(value) });
const summary = (currencyCode: string | null = "USD", value = 1250) => ({ currencyCode, totalCount: 1, totalAmount: value, totalAmountMinor: String(value),
  totalApplied: 0, totalAppliedMinor: "0", totalRemaining: value, totalRemainingMinor: String(value), statusBreakdown: { draft: { count: 1, amount: value, amountMinor: String(value) } } });

test("credit creation previews match both extended-price transports across currency scales and low digits", () => {
  const taxId = randomUUID();
  for (const [currency, price, quantity, taxed] of [
    ["USD", "12.50", "1.25", true], ["IRR", "1250", "1", true], ["JPY", "1250", "1", true], ["KWD", "1.250", "1", true],
    ["USD", "0.005", "3", false], ["USD", "-0.005", "1", false], ["USD", "90071992547409.91", "1", false],
    ["KWD", "9007199254740.991", "1", false],
  ] as const) {
    const lines = [{ ...line(price, quantity), taxRateId: taxed ? taxId : "" }];
    const preview = documentEditorPreview(lines, currency, [{ id: taxId, rate: 1000 }], false);
    assert.equal(preview.error, null);
    for (const transport of ["rest", "mcp"] as const) {
      const input = z.strictObject(transport === "rest" ? creditCreateFields : creditMcpCreateFields).parse({ contactId: randomUUID(),
        issueDate: "2026-10-11", currencyCode: currency, lines: creditNoteEditorLines(lines) });
      const totals = creditTotals(input.lines, transport, currency, new Map([[taxId, 1000]]));
      assert.equal(BigInt(totals.total), preview.total);
      assert.equal(BigInt(totals.processedLines[0].unitPrice), preview.lines[0].priceMinor);
      assert.equal(BigInt(totals.processedLines[0].amount), preview.lines[0].amountMinor);
    }
    assert.equal(creditNoteUiHeader(header(currency, Number(preview.total))).total, preview.total);
  }
  assert.equal(documentEditorPreview([line("0.005", "3")], "USD", [], false).total, 2n);
  assert.equal(documentEditorPreview([line("-0.005")], "USD", [], false).total, 0n);
  assert.equal(creditNoteEditorLines([line("", "0")])[0].quantity, 0);
  assert.equal(creditNoteEditorLines([line("", "")])[0].quantity, 1);
  for (const fields of [creditCreateFields, creditMcpCreateFields]) assert.equal(z.strictObject(fields).parse({ contactId: randomUUID(),
    issueDate: "2026-10-11", lines: creditNoteEditorLines([line()]) }).currencyCode, "USD");
});

test("credit inputs and saved money reject malformed, conflicting, unsafe and unresolved values", () => {
  for (const price of ["1x", "1e3", "NaN", "90071992547409.92"]) assert.ok(documentEditorPreview([line(price)], "USD", [], false).error);
  assert.ok(documentEditorPreview([line("90071992547409.91", "2")], "USD", [], false).error);
  assert.ok(documentEditorPreview([line()], null, [], false).error);
  assert.ok(documentEditorPreview([{ ...line(), taxRateId: randomUUID() }], "USD", [], false).error);
  for (const quantity of ["NaN", "1x", "1e3", "21474836.48"]) assert.throws(() => creditNoteEditorLines([line("1", quantity)]));
  assert.throws(() => creditNoteEditorLines([{ ...line(), description: " " }]));
  for (const change of [{ totalMinor: "01250" }, { totalMinor: "1251" }, { amountRemainingMinor: "1251" }, { total: 1.25 },
    { total: Number.MAX_SAFE_INTEGER + 1 }, { currencyCode: "BAD" }]) assert.throws(() => creditNoteUiHeader({ ...header(), ...change }));
  assert.equal(creditNoteUiHeader({ currencyCode: "USD", subtotal: 1250, taxTotal: 0, total: 1250, amountApplied: 0, amountRemaining: 1250 }).total, 1250n);
  assert.throws(() => creditNoteUiDocument({ ...header(), lines: [{ quantity: 1.5, unitPrice: 1250, amount: 1250, taxAmount: 0 }] }));
  assert.throws(() => creditNoteUiDocument({ ...header(), lines: [{ quantity: 100, unitPrice: 1250, unitPriceMinor: "1251", amount: 1250, taxAmount: 0 }] }));
});

test("credit summaries preserve exact aliases and require currency for nonzero amounts", () => {
  assert.equal(creditNoteUiSummary(summary("USD", Number.MAX_SAFE_INTEGER)).totalAmount, 9007199254740991n);
  assert.equal(creditNoteUiSummary(summary("KWD")).statusBreakdown.draft.amount, 1250n);
  assert.equal(creditNoteUiSummary(summary(null, 0)).totalAmount, 0n);
  assert.throws(() => creditNoteUiSummary(summary(null)));
  assert.throws(() => creditNoteUiSummary({ ...summary(), totalAmountMinor: "1251" }));
  assert.throws(() => creditNoteUiSummary({ ...summary(), statusBreakdown: { draft: { count: 1, amount: 1250, amountMinor: "1251" } } }));
});

test("credit application writes exact whole minor units and enforces customer, currency, status and bounds", () => {
  for (const [currencyCode, text] of [["USD", "12.50"], ["JPY", "1250"], ["IRR", "1250"], ["KWD", "1.250"], ["USD", "90071992547409.91"]]) {
    const credit = { contactId: randomUUID(), currencyCode, amountRemaining: currencyCode === "USD" && text.startsWith("900") ? 9007199254740991n : 1250n };
    const invoice = creditNoteUiInvoice({ id: randomUUID(), contactId: credit.contactId, currencyCode, status: "sent", amountDue: Number(credit.amountRemaining), amountDueMinor: String(credit.amountRemaining) });
    const payload = creditNoteUiApplication(text, credit, invoice);
    assert.equal(payload.amountMinor, String(credit.amountRemaining));
    assert.equal(creditAmount(z.strictObject(creditApplyFields).parse(payload)), Number(credit.amountRemaining));
    for (const change of [{ contactId: randomUUID() }, { currencyCode: "EUR" }, { status: "draft" }, { status: "void" }, { amountDue: 0n }]) {
      assert.equal(creditNoteUiInvoiceEligible(credit, { ...invoice, ...change }), false);
      assert.throws(() => creditNoteUiApplication(text, credit, { ...invoice, ...change }));
    }
    assert.throws(() => creditNoteUiApplication(text, { ...credit, amountRemaining: credit.amountRemaining - 1n }, invoice));
    assert.throws(() => creditNoteUiApplication(text, credit, { ...invoice, amountDue: credit.amountRemaining - 1n }));
    for (const invalid of ["", "0", "-1", "1x", "1e3", "9007199254740992", currencyCode === "KWD" ? "0.0001" : "0.001"])
      assert.throws(() => creditNoteUiApplication(invalid, credit, invoice));
  }
  assert.throws(() => creditNoteUiInvoice({ currencyCode: "USD", amountDue: 1250, amountDueMinor: "1251" }));
});

test("credit editor, saved details and amount control render exact English values and labels", () => {
  for (const [currencyCode, price, minor] of [["USD", "90071992547409.91", Number.MAX_SAFE_INTEGER], ["KWD", "1.250", 1250], ["JPY", "1250", 1250], ["IRR", "1250", 1250]] as const) {
    const editor = renderToStaticMarkup(createElement(LineItemsEditor, { lines: [line(price)], onChange: () => {}, currencyCode, roundPriceFirst: false, priceFractionDigits: 18 }));
    assert.ok(editor.includes(`Price (${currencyCode})`)); assert.ok(editor.includes(`${price}</span>`));
    assert.match(editor, /aria-label="Price for line 1"/); assert.match(editor, /inputMode="decimal"/);
    const credit = creditNoteUiDocument({ ...header(currencyCode, minor), lines: [{ id: "line", description: "Work", quantity: 125, unitPrice: minor, amount: minor, taxAmount: 0, account: null }] });
    const saved = renderToStaticMarkup(createElement(CreditNoteMoneyDetails, { credit }));
    assert.match(saved, />1\.25<\/span>/); assert.match(saved, /Subtotal:/); assert.match(saved, /Tax:/); assert.match(saved, /Remaining/);
    assert.ok(saved.includes(creditNoteUiMoney(BigInt(minor), currencyCode))); assert.match(saved, /overflow-x-auto/);
    const amount = renderToStaticMarkup(createElement(InvoiceAmountInput, { currency: currencyCode, value: price, onChange: () => {} }));
    assert.ok(amount.includes(`aria-label="Amount in ${currencyCode}"`)); assert.match(amount, /aria-invalid="false"/);
  }
  const invalid = renderToStaticMarkup(createElement(LineItemsEditor, { lines: [line("1x")], onChange: () => {}, currencyCode: "USD", roundPriceFirst: false }));
  assert.match(invalid, /role="alert"/); assert.doesNotMatch(invalid, />0\.00<\/span>/);
  const invalidAmount = renderToStaticMarkup(createElement(InvoiceAmountInput, { currency: "JPY", value: "1.2", onChange: () => {} }));
  assert.match(invalidAmount, /aria-invalid="true"/); assert.match(invalidAmount, /role="alert"/);
});
