import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { recurringBillEditorPayload, recurringBillEditorPreview, recurringBillUiDocument, recurringBillUiUpcoming } from "../lib/money/recurring-bill-ui";
import { recurringPayableStoredLines, recurringPayableTotals } from "../lib/api/recurring-payable-wire";
import { invoiceUiMoney } from "../lib/money/invoice-ui";
import { LineItemsEditor } from "../components/dashboard/line-items-editor";

const header = { name: "Recurring", contactId: randomUUID(), currencyCode: "USD", frequency: "monthly",
  startDate: "2026-10-11", endDate: "", maxOccurrences: "", reference: "reference" };
const payload = (lines: ReturnType<typeof line>[], currencyCode = "USD") => recurringBillEditorPayload({ ...header, currencyCode }, lines);
const line = (unitPrice = "12.50", quantity = "1") => ({ description: "Work", unitPrice, quantity, accountId: "", taxRateId: "" });
const saved = (unitPrice = 1250) => ({ id: "line", description: "Work", quantity: 125, unitPrice, unitPriceMinor: String(unitPrice), discountPercent: 1000 });

test("recurring preview rounds price AND physical quantity before extension, matching saved generation", () => {
  const taxId = randomUUID();
  for (const [currency, price, quantity] of [["USD", "0.005", "3"], ["USD", "12.505", "1.234"],
    ["USD", "-0.005", "1"], ["JPY", "12.5", "1.25"], ["IRR", "1250", "1.25"], ["KWD", "1.2505", "1.234"],
    ["USD", "90071992547409.91", "1"], ["KWD", "90071992547409.91", "1"]] as const) {
    const taxed = !price.startsWith("900719");
    const lines = [{ ...line(price, quantity), taxRateId: taxed ? taxId : "" }];
    const preview = recurringBillEditorPreview(lines, currency, [{ id: taxId, rate: 1000 }]);
    assert.equal(preview.error, null);
    const stored = recurringPayableStoredLines(payload(lines, currency).lines);
    const totals = recurringPayableTotals(stored, new Map([[taxId, 1000]]), "bill");
    assert.equal(preview.total, BigInt(totals.total));
    assert.equal(preview.lines[0].priceMinor, BigInt(stored[0].unitPrice));
    assert.equal(preview.lines[0].amountMinor, BigInt(totals.processedLines[0].amount));
  }
  assert.equal(recurringBillEditorPreview([line("0.005", "3")], "USD", []).total, 3n);
  assert.equal(recurringBillEditorPreview([line("1", "1.234")], "USD", []).total, 123n);
  assert.equal(recurringBillEditorPreview([line("", "0")], "USD", []).total, 0n);
  assert.equal(payload([line("", "")]).lines[0].quantity, 1);
  assert.equal(payload([line()]).currencyCode, "USD");
  assert.equal(payload([line()], "JPY").currencyCode, "JPY");
  assert.throws(() => payload([line()], "BAD"));
});

test("recurring editors reject malformed and out-of-range money, quantity, missing tax and descriptions", () => {
  for (const price of ["1x", "1e3", "NaN", "90071992547409.92", "0.1234567890123456789"])
    assert.ok(recurringBillEditorPreview([line(price)], "USD", []).error);
  for (const quantity of ["1x", "1e3", "NaN", "21474836.48"])
    assert.ok(recurringBillEditorPreview([line("1", quantity)], "USD", []).error);
  assert.ok(recurringBillEditorPreview([line("90071992547409.91", "2")], "USD", []).error);
  assert.ok(recurringBillEditorPreview([line("90071992547409.91"), line("0.01")], "USD", []).error);
  assert.ok(recurringBillEditorPreview([{ ...line(), taxRateId: randomUUID() }], "USD", []).error);
  assert.ok(recurringBillEditorPreview([line()], null, []).error);
  assert.throws(() => payload([{ ...line(), description: " " }]));
});

test("saved recurring aliases and gross upcoming totals preserve low digits without currency inference", () => {
  const row = { currencyCode: "KWD", lines: [saved(Number.MAX_SAFE_INTEGER)] };
  assert.throws(() => recurringBillUiDocument(row)); // gross exceeds the supported workflow range
  const document = recurringBillUiDocument({ ...row, lines: [{ ...saved(Number.MAX_SAFE_INTEGER), quantity: 100 }] });
  assert.equal(document.lines[0].unitPrice, 9007199254740991n);
  assert.equal(document.lines[0].grossMinor, 9007199254740991n);
  for (const change of [{ unitPriceMinor: "01250" }, { unitPriceMinor: "1251" }, { unitPrice: 1.25 },
    { unitPrice: 9007199254740992 }, { quantity: 1.25 }, { discountPercent: 10001 }])
    assert.throws(() => recurringBillUiDocument({ currencyCode: "USD", lines: [{ ...saved(), ...change }] }));
  assert.equal(recurringBillUiUpcoming({ currencyCode: "JPY", lineTotal: 1250, lineTotalMinor: "1250" }).lineTotal, 1250n);
  assert.throws(() => recurringBillUiUpcoming({ currencyCode: "JPY", lineTotal: 1250, lineTotalMinor: "1251" }));
  assert.throws(() => recurringBillUiUpcoming({ currencyCode: "BAD", lineTotal: 1250 }));
  assert.throws(() => recurringBillUiUpcoming({ lineTotal: 1250 } as never));
  assert.equal(recurringBillUiDocument({ currencyCode: "USD", lines: [{ ...saved(), unitPriceMinor: undefined }] }).lines[0].unitPrice, 1250n);
});

test("English editor distinguishes fixed-two input from currency-scaled generated amounts", () => {
  for (const [currencyCode, decimal] of [["USD", "12.50"], ["KWD", "1.250"], ["JPY", "1250"], ["IRR", "1250"]]) {
    const editor = renderToStaticMarkup(createElement(LineItemsEditor, { lines: [line("12.50")], onChange: () => {}, currencyCode,
      documentKind: "recurringBill", priceFractionDigits: 18 }));
    assert.match(editor, /Price \(fixed two-decimal scale\)/);
    assert.match(editor, /1.00 stores 100 units/);
    assert.ok(editor.includes(`${decimal}</span>`));
    assert.match(editor, /aria-label="Price for line 1"/); assert.match(editor, /inputMode="decimal"/);
    assert.match(editor, /overflow-x-auto/); assert.match(editor, /Tax uses the current rate/);
    assert.ok(invoiceUiMoney(1250n, currencyCode));
  }
  const invalid = renderToStaticMarkup(createElement(LineItemsEditor, { lines: [line("1x")], onChange: () => {}, currencyCode: "USD", documentKind: "recurringBill" }));
  assert.match(invalid, /role="alert"/);
});

test("payload preserves domain controls, zero quantities and every line; rejects malformed schedules", () => {
  const lines = [line("0.005", "0"), line("", "")];
  const row = payload(lines, "KWD");
  assert.equal(row.lines.length, 2); assert.equal(row.lines[0].quantity, 0);
  assert.equal(row.lines[0].unitPriceExact, "0.005"); assert.equal(row.lines[1].quantity, 1);
  assert.equal(row.lines[1].unitPriceExact, "0"); assert.equal(row.type, "bill");
  assert.equal(row.reference, "reference"); assert.equal(row.frequency, "monthly");
  for (const maxOccurrences of ["1x", "0", "-1", "1.5", "1e3", "2147483648"])
    assert.throws(() => recurringBillEditorPayload({ ...header, maxOccurrences }, lines));
  assert.throws(() => recurringBillEditorPayload({ ...header, endDate: "2026-09-01" }, lines));
  assert.throws(() => recurringBillEditorPayload({ ...header, startDate: "2026-02-30" }, lines));
  assert.throws(() => payload([line(), { ...line(), description: "" }]));
});
