import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { createElement } from "react";
import { renderToStaticMarkup } from "./helpers/presentation";
import { salesReceiptEditorLines, salesReceiptEditorCurrency, salesReceiptUiHeader, salesReceiptUiDocument,
  salesReceiptUiCollected, salesReceiptUiMoney } from "../lib/money/sales-receipt-ui";
import { documentEditorPreview } from "../lib/money/document-editor";
import { salesReceiptCreateSchema, salesReceiptTotals } from "../lib/api/sales-receipt-wire";
import { SalesReceiptMoneyDetails } from "../components/dashboard/sales-receipt-money-details";
import { LineItemsEditor } from "../components/dashboard/line-items-editor";

const line = (unitPrice = "12.50", quantity = "1") => ({ description: "Work", quantity, unitPrice, accountId: "", taxRateId: "" });
const header = (currencyCode = "USD", total = 1250) => ({ currencyCode, subtotal: total, subtotalMinor: String(total), taxTotal: 0,
  taxTotalMinor: "0", total, totalMinor: String(total) });

test("receipt exact preview matches extended-price transport policy across scales and safe low digits", () => {
  const taxId = randomUUID();
  for (const [currencyCode, price, quantity, taxed] of [
    ["USD", "12.50", "1.25", true], ["IRR", "1250", "1", true], ["JPY", "1250", "1", true], ["KWD", "1.250", "1", true],
    ["USD", "0.005", "3", false], ["USD", "-0.005", "1", false], ["USD", "90071992547409.91", "1", false],
    ["KWD", "9007199254740.991", "1", false],
  ] as const) {
    const lines = [{ ...line(price, quantity), taxRateId: taxed ? taxId : "" }];
    const preview = documentEditorPreview(lines, currencyCode, [{ id: taxId, rate: 1000 }], false);
    assert.equal(preview.error, null);
    const input = salesReceiptCreateSchema.parse({ contactId: randomUUID(), date: "2026-10-11", currencyCode, lines: salesReceiptEditorLines(lines) });
    const totals = salesReceiptTotals(input.lines, currencyCode, new Map([[taxId, 1000]]));
    assert.equal(BigInt(totals.total), preview.total);
    assert.equal(BigInt(totals.processedLines[0].unitPrice), preview.lines[0].priceMinor);
    assert.equal(BigInt(totals.processedLines[0].amount), preview.lines[0].amountMinor);
    assert.equal(salesReceiptUiHeader(header(currencyCode, totals.total)).total, preview.total);
  }
  assert.equal(documentEditorPreview([line("0.005", "3")], "USD", [], false).total, 2n);
  assert.equal(documentEditorPreview([line("-0.005")], "USD", [], false).total, 0n);
  assert.equal(salesReceiptEditorLines([line("", "0")])[0].quantity, 0);
  assert.equal(salesReceiptEditorLines([line("", "")])[0].quantity, 1);
});

test("receipt currency follows selection, customer, organization and USD fallback", () => {
  assert.equal(salesReceiptEditorCurrency("USD", "KWD", "JPY"), "USD");
  assert.equal(salesReceiptEditorCurrency("", "KWD", "JPY"), "KWD");
  assert.equal(salesReceiptEditorCurrency(null, null, "JPY"), "JPY");
  assert.equal(salesReceiptEditorCurrency(null, null, null), "USD");
  assert.throws(() => salesReceiptEditorCurrency("BAD", "USD", "USD"));
});

test("receipt input and saved adapters reject malformed, unsafe and conflicting money", () => {
  for (const price of ["1x", "1e3", "NaN", "90071992547409.92"]) assert.ok(documentEditorPreview([line(price)], "USD", [], false).error);
  assert.ok(documentEditorPreview([line("90071992547409.91", "2")], "USD", [], false).error);
  assert.ok(documentEditorPreview([line()], null, [], false).error);
  assert.ok(documentEditorPreview([{ ...line(), taxRateId: randomUUID() }], "USD", [], false).error);
  for (const quantity of ["NaN", "1x", "1e3", "21474836.48"]) assert.throws(() => salesReceiptEditorLines([line("1", quantity)]));
  assert.throws(() => salesReceiptEditorLines([{ ...line(), description: " " }]));
  for (const change of [{ totalMinor: "01250" }, { totalMinor: "1251" }, { total: 1.25 },
    { total: Number.MAX_SAFE_INTEGER + 1 }, { currencyCode: "BAD" }]) assert.throws(() => salesReceiptUiHeader({ ...header(), ...change }));
  assert.equal(salesReceiptUiHeader({ currencyCode: "USD", subtotal: 1250, taxTotal: 0, total: 1250 }).total, 1250n);
  assert.throws(() => salesReceiptUiDocument({ ...header(), lines: [{ quantity: 1.5, unitPrice: 1250, amount: 1250, taxAmount: 0 }] }));
  assert.throws(() => salesReceiptUiDocument({ ...header(), lines: [{ quantity: 100, unitPrice: 1250, unitPriceMinor: "1251", amount: 1250, taxAmount: 0 }] }));
});

test("collected groups only paid sample receipts by currency and preserves sums beyond safe Number", () => {
  const rows = [
    { status: "paid", total: 9007199254740991n, currencyCode: "USD" },
    { status: "paid", total: 1n, currencyCode: "USD" },
    { status: "paid", total: 1250n, currencyCode: "KWD" },
    { status: "draft", total: 1250n, currencyCode: "USD" },
    { status: "void", total: 1250n, currencyCode: "USD" },
  ];
  assert.equal(salesReceiptUiCollected(rows), `${salesReceiptUiMoney(1250n, "KWD")} · ${salesReceiptUiMoney(9007199254740992n, "USD")}`);
  assert.equal(salesReceiptUiCollected([]), "—");
  assert.equal(salesReceiptUiCollected(rows.filter(row => row.status !== "paid")), "—");
});

test("receipt editor and saved details render exact English money, fractions and accessible invalid input", () => {
  for (const [currencyCode, price, minor] of [["USD", "90071992547409.91", Number.MAX_SAFE_INTEGER], ["KWD", "1.250", 1250], ["JPY", "1250", 1250], ["IRR", "1250", 1250]] as const) {
    const editor = renderToStaticMarkup(createElement(LineItemsEditor, { lines: [line(price)], onChange: () => {}, currencyCode, roundPriceFirst: false, priceFractionDigits: 18 }));
    assert.ok(editor.includes(`Price (${currencyCode})`)); assert.ok(editor.includes(`${price}</span>`));
    assert.match(editor, /aria-label="Price for line 1"/); assert.match(editor, /inputMode="decimal"/);
    const receipt = salesReceiptUiDocument({ ...header(currencyCode, minor), lines: [{ id: "line", description: "Work", quantity: 125, unitPrice: minor, amount: minor, taxAmount: 0 }] });
    const saved = renderToStaticMarkup(createElement(SalesReceiptMoneyDetails, { receipt }));
    assert.match(saved, />1\.25<\/span>/); assert.match(saved, /Subtotal:/); assert.match(saved, /Tax:/); assert.match(saved, /Total:/);
    assert.ok(saved.includes(salesReceiptUiMoney(BigInt(minor), currencyCode))); assert.match(saved, /overflow-x-auto/);
  }
  const invalid = renderToStaticMarkup(createElement(LineItemsEditor, { lines: [line("1x")], onChange: () => {}, currencyCode: "USD", roundPriceFirst: false }));
  assert.match(invalid, /role="alert"/); assert.doesNotMatch(invalid, />0\.00<\/span>/);
});
