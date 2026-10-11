import assert from "node:assert/strict";
import { test } from "node:test";
import { billEditorCurrency, billEditorPreview, billLineInputs } from "../lib/money/bill-editor";
import { documentEditorDecimal } from "../lib/money/document-editor";

const standard = "10000000-0000-4000-8000-000000000001";
const reverse = "10000000-0000-4000-8000-000000000002";
const rates = [{ id: standard, rate: 1000, kind: "standard" }, { id: reverse, rate: 2000, kind: "reverse_charge" }];
const row = (unitPrice = "", quantity = "1", taxRateId = "") => ({ description: "Bill item", unitPrice, quantity, taxRateId, accountId: "" });

test("bill inputs retain exact price text, quantity controls and currency fallback", () => {
  const inputs = billLineInputs([row("90071992547409.91", "0"), row("", ""), row("1.005", "1.25")]);
  assert.equal(inputs[0].unitPriceExact, "90071992547409.91");
  assert.equal(inputs[0].unitPrice, undefined); assert.equal(inputs[0].quantity, 0);
  assert.equal(inputs[1].unitPriceExact, "0"); assert.equal(inputs[1].quantity, 1);
  assert.equal(inputs[2].quantity, 1.25); assert.equal(inputs[2].discountPercent, 0);
  assert.equal(billEditorCurrency(null, "JPY", "KWD"), "JPY");
  assert.equal(billEditorCurrency("USD", "JPY", "KWD"), "USD");
  assert.equal(billEditorCurrency(null, null, "KWD"), "KWD");
  assert.equal(billEditorCurrency(null, null, null), "USD");
});

test("bill previews retain scales, signed ties, extended price policy and low digits", () => {
  for (const [code, text, raw] of [["USD", "90071992547409.91", "9007199254740991"], ["JPY", "1250", "1250"],
    ["IRR", "1250", "1250"], ["KWD", "1.251", "1251"]]) {
    const preview = billEditorPreview([row(text)], code, []);
    assert.equal(preview.error, null); assert.equal(String(preview.total), raw);
    assert.equal(documentEditorDecimal(preview.total, code), text);
  }
  assert.equal(billEditorPreview([row("0.005", "3")], "USD", []).total, 2n);
  assert.equal(billEditorPreview([row("-0.005", "3")], "USD", []).total, -1n);
  assert.equal(billEditorPreview([row("40000000000000.01"), row("0.02")], "USD", []).total, 4000000000000003n);
  assert.equal(billEditorPreview([row("1.005", "1.25", standard)], "USD", rates).total, 139n);
});

test("bill totals show reverse charge tax and the separate exact supplier payable", () => {
  const preview = billEditorPreview([row("100", "1", reverse), row("10", "1", standard)], "USD", rates);
  assert.equal(preview.error, null);
  assert.equal(preview.subtotal, 11000n); assert.equal(preview.taxTotal, 2100n);
  assert.equal(preview.total, 13100n); assert.equal(preview.amountDue, 11100n);
  const signed = billEditorPreview([row("-0.005", "3", reverse)], "USD", rates);
  assert.equal(signed.total, -1n); assert.equal(signed.amountDue, -1n);
});

test("bill malformed, unresolved tax/currency, price/product/sum range and invalid controls fail closed", () => {
  for (const [lines, currency, taxRates] of [
    [[row("1x")], "USD", []], [[row("1e2")], "USD", []], [[row(" 1")], "USD", []],
    [[row("1.")], "USD", []], [[row("1")], null, []], [[row("1")], "XXX", []],
    [[row("90071992547409.92")], "USD", []], [[row("90071992547409.91", "2")], "USD", []],
    [[row("90071992547409.91"), row("0.01")], "USD", []],
    [[row("1", "21474836.48")], "USD", []], [[row("1", "1x")], "USD", []],
    [[row("1", "1", reverse)], "USD", []],
    [[row("1", "1", reverse)], "USD", [{ id: reverse, rate: 2000 }]],
    [[row("1", "1", reverse)], "USD", [{ id: reverse, rate: -1, kind: "reverse_charge" }]],
    [[], "USD", []], [Array.from({ length: 1001 }, () => row("0")), "USD", []],
  ] as const) {
    const preview = billEditorPreview(lines, currency, taxRates);
    assert.ok(preview.error); assert.equal(preview.inputs.length, 0);
    assert.equal(preview.total, 0n); assert.equal(preview.amountDue, 0n);
  }
});
