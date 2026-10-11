import assert from "node:assert/strict";
import { test } from "node:test";
import { documentLineInputs, documentPriceText, documentEditorPreview, documentEditorDecimal, invoiceEditorCurrency } from "../lib/money/document-editor";

const taxId = "00000000-0000-4000-8000-000000000001";
const row = (unitPrice: string, quantity = "1", taxRateId = "") => ({ description: "Item", quantity, unitPrice, accountId: "", taxRateId });

test("invoice editor retains exact prices and currency-scale low digits", () => {
  for (const [currency, text, minor] of [
    ["USD", "90071992547409.91", "9007199254740991"], ["JPY", "1250", "1250"],
    ["IRR", "1250", "1250"], ["KWD", "1.251", "1251"],
  ]) {
    const preview = documentEditorPreview([row(text)], currency, [], true);
    assert.equal(preview.error, null); assert.equal(String(preview.total), minor);
    assert.equal(documentEditorDecimal(preview.total, currency), text);
    assert.equal(preview.inputs[0].unitPriceExact, text);
    assert.equal(preview.inputs[0].unitPrice, undefined);
  }
  const low = documentEditorPreview([row("40000000000000.01"), row("0.02")], "USD", [], true);
  assert.equal(low.total, 4000000000000003n);
  assert.equal(documentEditorDecimal(low.total, "USD"), "40000000000000.03");
});

test("REST create price-first preview preserves signed ties and tax-exclusive totals", () => {
  for (const [code, half] of [["USD", "0.005"], ["JPY", "0.5"], ["IRR", "0.5"], ["KWD", "0.0005"]]) {
    assert.equal(documentEditorPreview([row(half, "3")], code, [], true).total, 3n);
    assert.equal(documentEditorPreview([row(half, "3")], code, [], false).total, 2n);
    assert.equal(documentEditorPreview([row(`-${half}`, "3")], code, [], true).total, 0n);
    assert.equal(documentEditorPreview([row(`-${half}`, "3")], code, [], false).total, -1n);
  }
  const preview = documentEditorPreview([row("0.10", "1", taxId), row("0.20", "1", taxId)], "USD", [{ id: taxId, rate: 1000 }], true);
  assert.equal(preview.subtotal, 30n); assert.equal(preview.taxTotal, 3n); assert.equal(preview.total, 33n);
  assert.equal(documentEditorPreview([row("0.05", "1", taxId)], "USD", [{ id: taxId, rate: 1000 }], true).taxTotal, 1n);
  assert.equal(documentEditorPreview([row("-0.05", "1", taxId)], "USD", [{ id: taxId, rate: 1000 }], true).taxTotal, 0n);
});

test("malformed, incomplete and unsafe editor values fail closed", () => {
  for (const value of ["1e2", "1x", "NaN", "Infinity", ".5", "1.", "1,000", " 1", "۱", "0.1234567890123456789", "90071992547409.92"]) {
    const preview = documentEditorPreview([row(value)], "USD", [], true);
    assert.ok(preview.error, value); assert.deepEqual(preview.inputs, []);
  }
  for (const quantity of ["NaN", "1e2", "1x", "21474836.48", "-21474836.49"]) {
    assert.ok(documentEditorPreview([row("1", quantity)], "USD", [], true).error, quantity);
  }
  assert.ok(documentEditorPreview([row("90071992547409.91", "2")], "USD", [], true).error);
  assert.ok(documentEditorPreview([row("90071992547409.91"), row("0.01")], "USD", [], true).error);
  assert.ok(documentEditorPreview([row("90071992547409.91", "1", taxId)], "USD", [{ id: taxId, rate: 1000 }], true).error);
  assert.ok(documentEditorPreview([row("1", "1", taxId)], "USD", [], true).error);
  assert.ok(documentEditorPreview([row("1")], null, [], true).error);
  assert.ok(documentEditorPreview([row("1")], "ZZZ", [], true).error);
  assert.throws(() => documentLineInputs([]));
  assert.throws(() => documentLineInputs(Array.from({ length: 1001 }, () => row("0"))));
});

test("quantity and basis-point controls retain their wire units; price strings stay exact", () => {
  assert.equal(documentPriceText("0001.000000000000000001"), "1.000000000000000001");
  const input = documentLineInputs([row("1.005", "1.25")])[0];
  assert.equal(input.quantity, 1.25); assert.equal(input.discountPercent, 0);
  assert.equal(input.unitPriceExact, "1.005"); assert.equal(input.accountId, null);
  assert.equal(documentEditorPreview([row("1", "0")], "USD", [], true).total, 0n);
  assert.equal(documentEditorPreview([row("", "")], "USD", [], true).total, 0n);
  assert.equal(documentLineInputs([row("", "")])[0].quantity, 1);
});

test("invoice currency follows explicit selection, customer, organization, then USD", () => {
  assert.equal(invoiceEditorCurrency("KWD", "JPY", "USD"), "KWD");
  assert.equal(invoiceEditorCurrency(null, "JPY", "USD"), "JPY");
  assert.equal(invoiceEditorCurrency(null, null, "IRR"), "IRR");
  assert.equal(invoiceEditorCurrency(null, null, null), "USD");
  assert.throws(() => invoiceEditorCurrency("ZZZ", "USD", "USD"));
  assert.throws(() => invoiceEditorCurrency(null, "", "USD"));
});
