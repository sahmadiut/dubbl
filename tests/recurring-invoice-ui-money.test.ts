import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { recurringInvoiceEditorCurrency, recurringInvoiceEditorLines, recurringInvoiceEditorPreview,
  recurringInvoiceUiDocument, recurringInvoiceUiUpcoming, recurringInvoiceUiMoney } from "../lib/money/recurring-invoice-ui";
import { recurringInvoiceStoredLines, recurringInvoiceTotals } from "../lib/api/recurring-invoice-wire";
import { RecurringInvoiceMoneyDetails } from "../components/dashboard/recurring-invoice-money-details";
import { LineItemsEditor } from "../components/dashboard/line-items-editor";

const line = (unitPrice = "12.50", quantity = "1") => ({ description: "Work", unitPrice, quantity, accountId: "", taxRateId: "" });
const saved = (unitPrice = 1250) => ({ id: "line", description: "Work", quantity: 125, unitPrice, unitPriceMinor: String(unitPrice), discountPercent: 1000 });

test("recurring preview rounds price AND physical quantity before extension, matching saved generation", () => {
  const taxId = randomUUID();
  for (const [currency, price, quantity] of [["USD", "0.005", "3"], ["USD", "12.505", "1.234"],
    ["USD", "-0.005", "1"], ["JPY", "12.5", "1.25"], ["IRR", "1250", "1.25"], ["KWD", "1.2505", "1.234"],
    ["USD", "90071992547409.91", "1"], ["KWD", "9007199254740.991", "1"]] as const) {
    const taxed = !price.startsWith("900719");
    const lines = [{ ...line(price, quantity), taxRateId: taxed ? taxId : "" }];
    const preview = recurringInvoiceEditorPreview(lines, currency, [{ id: taxId, rate: 1000 }]);
    assert.equal(preview.error, null);
    const stored = recurringInvoiceStoredLines(recurringInvoiceEditorLines(lines), currency);
    const totals = recurringInvoiceTotals(stored, new Map([[taxId, 1000]]));
    assert.equal(preview.total, BigInt(totals.total));
    assert.equal(preview.lines[0].priceMinor, BigInt(stored[0].unitPrice));
    assert.equal(preview.lines[0].amountMinor, BigInt(totals.processedLines[0].amount));
  }
  assert.equal(recurringInvoiceEditorPreview([line("0.005", "3")], "USD", []).total, 3n);
  assert.equal(recurringInvoiceEditorPreview([line("1", "1.234")], "USD", []).total, 123n);
  assert.equal(recurringInvoiceEditorPreview([line("", "0")], "USD", []).total, 0n);
  assert.equal(recurringInvoiceEditorLines([line("", "")])[0].quantity, 1);
  assert.equal(recurringInvoiceEditorCurrency(), "USD");
  assert.equal(recurringInvoiceEditorCurrency("JPY"), "JPY");
  assert.throws(() => recurringInvoiceEditorCurrency("BAD"));
});

test("recurring editors reject malformed and out-of-range money, quantity, missing tax and descriptions", () => {
  for (const price of ["1x", "1e3", "NaN", "90071992547409.92", "0.1234567890123456789"])
    assert.ok(recurringInvoiceEditorPreview([line(price)], "USD", []).error);
  for (const quantity of ["1x", "1e3", "NaN", "21474836.48"])
    assert.ok(recurringInvoiceEditorPreview([line("1", quantity)], "USD", []).error);
  assert.ok(recurringInvoiceEditorPreview([line("90071992547409.91", "2")], "USD", []).error);
  assert.ok(recurringInvoiceEditorPreview([line("90071992547409.91"), line("0.01")], "USD", []).error);
  assert.ok(recurringInvoiceEditorPreview([{ ...line(), taxRateId: randomUUID() }], "USD", []).error);
  assert.ok(recurringInvoiceEditorPreview([line()], null, []).error);
  assert.throws(() => recurringInvoiceEditorLines([{ ...line(), description: " " }]));
});

test("saved recurring aliases and gross upcoming totals preserve low digits without currency inference", () => {
  const row = { currencyCode: "KWD", lines: [saved(Number.MAX_SAFE_INTEGER)] };
  assert.throws(() => recurringInvoiceUiDocument(row)); // gross exceeds the supported workflow range
  const document = recurringInvoiceUiDocument({ ...row, lines: [{ ...saved(Number.MAX_SAFE_INTEGER), quantity: 100 }] });
  assert.equal(document.lines[0].unitPrice, 9007199254740991n);
  assert.equal(document.lines[0].grossMinor, 9007199254740991n);
  for (const change of [{ unitPriceMinor: "01250" }, { unitPriceMinor: "1251" }, { unitPrice: 1.25 },
    { unitPrice: 9007199254740992 }, { quantity: 1.25 }, { discountPercent: 10001 }])
    assert.throws(() => recurringInvoiceUiDocument({ currencyCode: "USD", lines: [{ ...saved(), ...change }] }));
  assert.equal(recurringInvoiceUiUpcoming({ currencyCode: "JPY", lineTotal: 1250, lineTotalMinor: "1250" }).lineTotal, 1250n);
  assert.throws(() => recurringInvoiceUiUpcoming({ currencyCode: "JPY", lineTotal: 1250, lineTotalMinor: "1251" }));
  assert.throws(() => recurringInvoiceUiUpcoming({ currencyCode: "BAD", lineTotal: 1250 }));
  assert.throws(() => recurringInvoiceUiUpcoming({ lineTotal: 1250 } as never));
  assert.equal(recurringInvoiceUiDocument({ currencyCode: "USD", lines: [{ ...saved(), unitPriceMinor: undefined }] }).lines[0].unitPrice, 1250n);
});

test("English editor and saved details show exact currency prices, fractional quantity and gross meaning", () => {
  for (const [currencyCode, price, minor] of [["USD", "90071992547409.91", Number.MAX_SAFE_INTEGER],
    ["KWD", "1.250", 1250], ["JPY", "1250", 1250], ["IRR", "1250", 1250]] as const) {
    const editor = renderToStaticMarkup(createElement(LineItemsEditor, { lines: [line(price)], onChange: () => {}, currencyCode,
      documentKind: "recurringInvoice", priceFractionDigits: 18 }));
    assert.ok(editor.includes(`Price (${currencyCode})`)); assert.ok(editor.includes(`${price}</span>`));
    assert.match(editor, /aria-label="Price for line 1"/); assert.match(editor, /inputMode="decimal"/);
    const row = recurringInvoiceUiDocument({ currencyCode, lines: [{ ...saved(minor), quantity: minor === Number.MAX_SAFE_INTEGER ? 100 : 125 }] });
    const details = renderToStaticMarkup(createElement(RecurringInvoiceMoneyDetails, row));
    assert.ok(details.includes(recurringInvoiceUiMoney(BigInt(minor), currencyCode)));
    if (minor !== Number.MAX_SAFE_INTEGER) assert.match(details, />1\.25<\/span>/);
    assert.match(details, /Gross Amount/); assert.match(details, /Before discounts and tax/); assert.match(details, /overflow-x-auto/);
  }
  const invalid = renderToStaticMarkup(createElement(LineItemsEditor, { lines: [line("1x")], onChange: () => {}, currencyCode: "USD", documentKind: "recurringInvoice" }));
  assert.match(invalid, /role="alert"/);
});
