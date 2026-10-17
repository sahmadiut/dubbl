import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { createElement } from "react";
import { renderToStaticMarkup } from "./helpers/presentation";
import { debitNoteEditorLines, debitNoteUiHeader, debitNoteUiDocument, debitNoteUiOverview, debitNoteUiBill,
  debitNoteUiApplication, debitNoteUiBillEligible, debitNoteUiMoney } from "../lib/money/debit-note-ui";
import { documentEditorPreview } from "../lib/money/document-editor";
import { debitNoteCreateFields, debitNoteMcpCreateFields, debitNoteTotals, debitNoteApplyFields } from "../lib/api/debit-note-wire";
import { creditAmount } from "../lib/api/credit-wire";
import { DebitNoteOverview } from "../components/dashboard/debit-note-overview";
import { DebitNoteMoneyDetails } from "../components/dashboard/debit-note-money-details";
import { LineItemsEditor } from "../components/dashboard/line-items-editor";
import { InvoiceAmountInput } from "../components/dashboard/invoice-amount-input";

const line = (unitPrice = "12.50", quantity = "1") => ({ description: "Work", quantity, unitPrice, accountId: "", taxRateId: "" });
const header = (currencyCode = "USD", value = 1250) => ({ currencyCode, subtotal: value, subtotalMinor: String(value), taxTotal: 0,
  taxTotalMinor: "0", total: value, totalMinor: String(value), amountApplied: 0, amountAppliedMinor: "0", amountRemaining: value, amountRemainingMinor: String(value) });
test("debit creation previews match both extended-price transports across currency scales and low digits", () => {
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
      const input = z.strictObject(transport === "rest" ? debitNoteCreateFields : debitNoteMcpCreateFields).parse({ contactId: randomUUID(),
        issueDate: "2026-10-11", currencyCode: currency, lines: debitNoteEditorLines(lines) });
      const totals = debitNoteTotals(input.lines, transport, currency, new Map([[taxId, 1000]]));
      assert.equal(BigInt(totals.total), preview.total);
      assert.equal(BigInt(totals.processedLines[0].unitPrice), preview.lines[0].priceMinor);
      assert.equal(BigInt(totals.processedLines[0].amount), preview.lines[0].amountMinor);
    }
    assert.equal(debitNoteUiHeader(header(currency, Number(preview.total))).total, preview.total);
  }
  assert.equal(documentEditorPreview([line("0.005", "3")], "USD", [], false).total, 2n);
  assert.equal(documentEditorPreview([line("-0.005")], "USD", [], false).total, 0n);
  assert.equal(debitNoteEditorLines([line("", "0")])[0].quantity, 0);
  assert.equal(debitNoteEditorLines([line("", "")])[0].quantity, 1);
  for (const fields of [debitNoteCreateFields, debitNoteMcpCreateFields]) assert.equal(z.strictObject(fields).parse({ contactId: randomUUID(),
    issueDate: "2026-10-11", lines: debitNoteEditorLines([line()]) }).currencyCode, "USD");
});

test("debit inputs and saved money reject malformed, conflicting, unsafe and unresolved values", () => {
  for (const price of ["1x", "1e3", "NaN", "90071992547409.92"]) assert.ok(documentEditorPreview([line(price)], "USD", [], false).error);
  assert.ok(documentEditorPreview([line("90071992547409.91", "2")], "USD", [], false).error);
  assert.ok(documentEditorPreview([line()], null, [], false).error);
  assert.ok(documentEditorPreview([{ ...line(), taxRateId: randomUUID() }], "USD", [], false).error);
  for (const quantity of ["NaN", "1x", "1e3", "21474836.48"]) assert.throws(() => debitNoteEditorLines([line("1", quantity)]));
  assert.throws(() => debitNoteEditorLines([{ ...line(), description: " " }]));
  for (const change of [{ totalMinor: "01250" }, { totalMinor: "1251" }, { amountRemainingMinor: "1251" }, { total: 1.25 },
    { total: Number.MAX_SAFE_INTEGER + 1 }, { currencyCode: "BAD" }]) assert.throws(() => debitNoteUiHeader({ ...header(), ...change }));
  assert.equal(debitNoteUiHeader({ currencyCode: "USD", subtotal: 1250, taxTotal: 0, total: 1250, amountApplied: 0, amountRemaining: 1250 }).total, 1250n);
  assert.throws(() => debitNoteUiDocument({ ...header(), lines: [{ quantity: 1.5, unitPrice: 1250, amount: 1250, taxAmount: 0 }] }));
  assert.throws(() => debitNoteUiDocument({ ...header(), lines: [{ quantity: 100, unitPrice: 1250, unitPriceMinor: "1251", amount: 1250, taxAmount: 0 }] }));
});

test("debit overview groups exact sample amounts by currency and excludes voids", () => {
  const rows = [
    { ...debitNoteUiHeader(header("USD", Number.MAX_SAFE_INTEGER)), status: "sent" },
    { ...debitNoteUiHeader(header("USD", Number.MAX_SAFE_INTEGER)), status: "draft" },
    { ...debitNoteUiHeader(header("JPY")), status: "sent" },
    { ...debitNoteUiHeader(header("KWD")), status: "sent" },
    { ...debitNoteUiHeader(header("USD")), status: "void" },
  ];
  const groups = debitNoteUiOverview(rows);
  assert.equal(groups.length, 3);
  assert.equal(groups.find(group => group.currencyCode === "USD")?.total, 18014398509481982n);
  assert.equal(groups.find(group => group.currencyCode === "JPY")?.amountRemaining, 1250n);
  const markup = renderToStaticMarkup(createElement(DebitNoteOverview, { groups }));
  for (const group of groups) assert.ok(markup.includes(debitNoteUiMoney(group.total, group.currencyCode)));
  assert.ok(markup.includes("$180,143,985,094,819.82"));
  assert.match(renderToStaticMarkup(createElement(DebitNoteOverview, { groups: [] })), /—/);
});

test("debit application writes exact whole minor units and enforces supplier, currency, status and bounds", () => {
  for (const [currencyCode, text] of [["USD", "12.50"], ["JPY", "1250"], ["IRR", "1250"], ["KWD", "1.250"], ["USD", "90071992547409.91"]]) {
    const credit = { status: "sent", contactId: randomUUID(), currencyCode, amountRemaining: currencyCode === "USD" && text.startsWith("900") ? 9007199254740991n : 1250n };
    const invoice = debitNoteUiBill({ id: randomUUID(), contactId: credit.contactId, currencyCode, status: "received", amountDue: Number(credit.amountRemaining), amountDueMinor: String(credit.amountRemaining) });
    const payload = debitNoteUiApplication(text, credit, invoice);
    assert.equal(payload.amountMinor, String(credit.amountRemaining));
    assert.equal(creditAmount(z.strictObject(debitNoteApplyFields).parse(payload)), Number(credit.amountRemaining));
    for (const change of [{ contactId: randomUUID() }, { currencyCode: "EUR" }, { status: "draft" }, { status: "pending_approval" }, { status: "sent" }, { status: "paid" }, { status: "void" }, { amountDue: 0n }]) {
      assert.equal(debitNoteUiBillEligible(credit, { ...invoice, ...change }), false);
      assert.throws(() => debitNoteUiApplication(text, credit, { ...invoice, ...change }));
    }
    for (const status of ["draft", "applied", "void"]) assert.throws(() => debitNoteUiApplication(text, { ...credit, status }, invoice));
    assert.throws(() => debitNoteUiApplication(text, { ...credit, amountRemaining: credit.amountRemaining - 1n }, invoice));
    assert.throws(() => debitNoteUiApplication(text, credit, { ...invoice, amountDue: credit.amountRemaining - 1n }));
    for (const invalid of ["", "0", "-1", "1x", "1e3", "9007199254740992", currencyCode === "KWD" ? "0.0001" : "0.001"])
      assert.throws(() => debitNoteUiApplication(invalid, credit, invoice));
  }
  assert.throws(() => debitNoteUiBill({ currencyCode: "USD", amountDue: 1250, amountDueMinor: "1251" }));
});

test("debit editor, saved details and amount control render exact English values and labels", () => {
  for (const [currencyCode, price, minor] of [["USD", "90071992547409.91", Number.MAX_SAFE_INTEGER], ["KWD", "1.250", 1250], ["JPY", "1250", 1250], ["IRR", "1250", 1250]] as const) {
    const editor = renderToStaticMarkup(createElement(LineItemsEditor, { lines: [line(price)], onChange: () => {}, currencyCode, roundPriceFirst: false, priceFractionDigits: 18 }));
    assert.ok(editor.includes(`Price (${currencyCode})`)); assert.ok(editor.includes(`${price}</span>`));
    assert.match(editor, /aria-label="Price for line 1"/); assert.match(editor, /inputMode="decimal"/);
    const credit = debitNoteUiDocument({ ...header(currencyCode, minor), lines: [{ id: "line", description: "Work", quantity: 125, unitPrice: minor, amount: minor, taxAmount: 0, account: null }] });
    const saved = renderToStaticMarkup(createElement(DebitNoteMoneyDetails, { credit }));
    assert.match(saved, />1\.25<\/span>/); assert.match(saved, /Subtotal:/); assert.match(saved, /Tax:/); assert.match(saved, /Remaining/);
    assert.ok(saved.includes(debitNoteUiMoney(BigInt(minor), currencyCode))); assert.match(saved, /overflow-x-auto/);
    const amount = renderToStaticMarkup(createElement(InvoiceAmountInput, { currency: currencyCode, value: price, onChange: () => {} }));
    assert.ok(amount.includes(`aria-label="Amount in ${currencyCode}"`)); assert.match(amount, /aria-invalid="false"/);
  }
  const invalid = renderToStaticMarkup(createElement(LineItemsEditor, { lines: [line("1x")], onChange: () => {}, currencyCode: "USD", roundPriceFirst: false }));
  assert.match(invalid, /role="alert"/); assert.doesNotMatch(invalid, />0\.00<\/span>/);
  const invalidAmount = renderToStaticMarkup(createElement(InvoiceAmountInput, { currency: "JPY", value: "1.2", onChange: () => {} }));
  assert.match(invalidAmount, /aria-invalid="true"/); assert.match(invalidAmount, /role="alert"/);
});
