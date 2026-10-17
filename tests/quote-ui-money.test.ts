import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { createElement } from "react";
import { renderToStaticMarkup } from "./helpers/presentation";
import { quoteEditorLines, quoteUiHeader, quoteUiDocument, quoteUiSummary, quoteUiMoney } from "../lib/money/quote-ui";
import { documentEditorPreview } from "../lib/money/document-editor";
import { parseQuoteCreate, quoteInputLines, quoteTotals } from "../lib/api/quote-wire";
import { QuoteMoneyDetails } from "../components/dashboard/quote-money-details";
import { LineItemsEditor } from "../components/dashboard/line-items-editor";

const line = (unitPrice = "12.50", quantity = "1") => ({ description: "Work", quantity, unitPrice, accountId: "", taxRateId: "" });
const header = (currencyCode = "USD", value = 1250) => ({ currencyCode, subtotal: value, subtotalMinor: String(value), taxTotal: 0,
  taxTotalMinor: "0", total: value, totalMinor: String(value), billedTotal: 0, billedTotalMinor: "0" });

test("quote editor payloads match both price-first transport policies across scales", () => {
  for (const [currency, price] of [["USD", "12.50"], ["IRR", "1250"], ["JPY", "1250"], ["KWD", "1.250"], ["USD", "90071992547409.91"]]) {
    const lines = [line(price)];
    const preview = documentEditorPreview(lines, currency, [], true);
    assert.equal(preview.error, null);
    for (const transport of ["rest", "mcp"] as const) {
      const parsed = parseQuoteCreate({ contactId: randomUUID(), issueDate: "2026-10-11", expiryDate: "2099-01-01",
        currencyCode: currency, lines: quoteEditorLines(lines) }, transport);
      const totals = quoteTotals(quoteInputLines(parsed.lines, transport), currency, new Map());
      assert.equal(BigInt(totals.total), preview.total);
    }
    assert.equal(quoteUiHeader(header(currency, Number(preview.total))).total, preview.total);
  }
  const taxId = randomUUID(), lines = [{ ...line("0.005", "3"), taxRateId: taxId }];
  const preview = documentEditorPreview(lines, "USD", [{ id: taxId, rate: 1000 }], true);
  assert.equal(preview.total, 3n); // Price-first: 1 minor x 3, tax rounds to zero.
  assert.equal(documentEditorPreview([line("-0.005")], "USD", [], true).total, 0n);
  assert.equal(quoteEditorLines([line("", "0")])[0].quantity, 0);
  assert.equal(quoteEditorLines([line("", "")])[0].quantity, 1);
  assert.equal(quoteEditorLines([line("", "1.25")])[0].quantity, 1.25);
  assert.equal(parseQuoteCreate({ contactId: randomUUID(), issueDate: "2026-10-11", expiryDate: "2099-01-01", lines: quoteEditorLines([line()]) }, "rest").currencyCode, "USD");
});

test("quote input and saved aliases reject malformed, conflicting and unsafe money", () => {
  for (const price of ["1x", "1e3", "NaN", "90071992547409.92"]) assert.ok(documentEditorPreview([line(price)], "USD", [], true).error);
  assert.ok(documentEditorPreview([line("90071992547409.91", "2")], "USD", [], true).error);
  assert.ok(documentEditorPreview([line("1")], null, [], true).error);
  assert.ok(documentEditorPreview([{ ...line(), taxRateId: randomUUID() }], "USD", [], true).error);
  assert.throws(() => quoteEditorLines([{ ...line(), description: " " }]));
  for (const change of [{ totalMinor: "01250" }, { totalMinor: "1251" }, { total: 1.25 }, { total: Number.MAX_SAFE_INTEGER + 1 }, { currencyCode: "BAD" }])
    assert.throws(() => quoteUiHeader({ ...header(), ...change }));
  assert.equal(quoteUiHeader({ currencyCode: "USD", subtotal: 1250, taxTotal: 0, total: 1250, billedTotal: 0 }).total, 1250n);
  assert.throws(() => quoteUiDocument({ ...header(), lines: [{ quantity: 1.5, unitPrice: 1250, amount: 1250, taxAmount: 0 }] }));
  assert.throws(() => quoteUiDocument({ ...header(), lines: [{ quantity: 100, unitPrice: 1250, unitPriceMinor: "1251", amount: 1250, taxAmount: 0 }] }));
});

test("quote list sums stay exact and grouped by currency and status", () => {
  const rows = [{ ...quoteUiHeader(header()), status: "sent" }, { ...quoteUiHeader(header("KWD")), status: "sent" },
    { ...quoteUiHeader(header("USD", Number.MAX_SAFE_INTEGER)), status: "accepted" }];
  assert.equal(quoteUiSummary(rows, "sent"), `${quoteUiMoney(1250n, "KWD")} · $12.50`);
  assert.equal(quoteUiSummary(rows, "accepted"), "$90,071,992,547,409.91");
  assert.equal(quoteUiSummary([...rows, rows[2]], "accepted"), "$180,143,985,094,819.82");
  assert.equal(quoteUiSummary(rows, "declined"), "—");
});

test("real quote editor and saved details render exact English currency and fractional quantity", () => {
  for (const [currencyCode, price, minor] of [["USD", "90071992547409.91", Number.MAX_SAFE_INTEGER], ["KWD", "1.250", 1250], ["JPY", "1250", 1250], ["IRR", "1250", 1250]] as const) {
    const editor = renderToStaticMarkup(createElement(LineItemsEditor, { lines: [line(price)], onChange: () => {},
      currencyCode, roundPriceFirst: true, priceFractionDigits: 18 }));
    assert.ok(editor.includes(`Price (${currencyCode})`));
    assert.ok(editor.includes(`${price}</span>`));
    assert.match(editor, /aria-label="Price for line 1"/); assert.match(editor, /inputMode="decimal"/);
    const quote = quoteUiDocument({ ...header(currencyCode, minor), lines: [{ id: "line", description: "Work", quantity: 125,
      unitPrice: minor, amount: minor, taxAmount: 0, account: null }] });
    const saved = renderToStaticMarkup(createElement(QuoteMoneyDetails, { quote }));
    assert.match(saved, />1\.25<\/span>/); assert.match(saved, /Subtotal:/); assert.match(saved, /Tax:/);
    assert.ok(saved.includes(quoteUiMoney(BigInt(minor), currencyCode))); assert.match(saved, /overflow-x-auto/);
  }
  const invalid = renderToStaticMarkup(createElement(LineItemsEditor, { lines: [line("1x")], onChange: () => {}, currencyCode: "USD", roundPriceFirst: true }));
  assert.match(invalid, /role="alert"/); assert.doesNotMatch(invalid, />0\.00<\/span>/);
});
