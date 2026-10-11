import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TaxSettlementPreview } from "../components/dashboard/tax-settlement-preview";
import { taxUiMinor, taxUiCurrency, taxUiRows, taxUiAbs, taxUiMax, taxUiPercent, taxUiMoney, taxUiDecimal, taxUiSettlement, taxUiConditions, taxUiRate, taxUiRateInput } from "../lib/money/tax-ui";

test("tax saved raw units and aliases reject unsupported money before presentation", () => {
  for (const amount of [0, 1250, -1250, 3000000001, Number.MAX_SAFE_INTEGER]) {
    assert.equal(taxUiMinor(amount, String(amount)), BigInt(amount));
    assert.equal(taxUiMinor(amount), BigInt(amount));
  }
  for (const value of [-0, NaN, Infinity, 0.5, Number.MAX_SAFE_INTEGER + 1, "1250", null]) assert.throws(() => taxUiMinor(value));
  for (const alias of ["01250", "+1250", "1250.0", "1e3", "1251", null, "9223372036854775807"]) assert.throws(() => taxUiMinor(1250, alias));
  assert.throws(() => taxUiMinor(0, "-0"));
  for (const code of ["usd", " USD", "BAD", null]) assert.throws(() => taxUiCurrency(code));
  assert.throws(() => taxUiRows([{ amount: 1250, amountMinor: "1251" }], ["amount"]));
  assert.throws(() => taxUiRows<{ amount: number }, "amount">(null as never, ["amount"]));
});

test("tax settlement scale, preview, exact payload and English rendering agree", () => {
  for (const [code, text] of [["USD", "12.50"], ["JPY", "1250"], ["IRR", "1250"], ["KWD", "1.250"]]) {
    const result = taxUiSettlement(text, code);
    assert.equal(result.error, null); assert.equal(result.amountMinor, "1250");
    assert.equal(taxUiSettlement(taxUiDecimal(1250n, code), code).amount, 1250n);
    const html = renderToStaticMarkup(createElement(TaxSettlementPreview, { amount: text, currency: code }));
    assert.match(html, /role="status"/); assert.match(html, /Settlement:/);
    assert.ok(html.includes(taxUiMoney(1250n, code).replace(/&/g, "&amp;")));
    const max = taxUiDecimal(BigInt(Number.MAX_SAFE_INTEGER), code);
    assert.equal(taxUiSettlement(max, code).amountMinor, "9007199254740991");
  }
  for (const [code, text] of [["USD", "0.005"], ["JPY", "0.1"], ["KWD", "0.0001"], ["USD", "90071992547409.92"], ["USD", ""], ["USD", "12abc"], ["USD", "1e3"], ["USD", "-1"], ["USD", ".5"], ["BAD", "1"]]) {
    assert.ok(taxUiSettlement(text, code).error);
    assert.match(renderToStaticMarkup(createElement(TaxSettlementPreview, { amount: text, currency: code })), /role="alert"/);
  }
  assert.equal(taxUiSettlement("0", "JPY").amount, 0n); // existing zero no-op policy
});

test("tax aggregates and visual ratios keep low digits beyond numeric sum range", () => {
  const rows = taxUiRows([{ amount: Number.MAX_SAFE_INTEGER, amountMinor: "9007199254740991" }, { amount: 2 }], ["amount"]);
  const sum = rows.reduce((total, row) => total + row.amount, 0n);
  assert.equal(sum, 9007199254740993n);
  assert.equal(taxUiMoney(sum, "USD"), "$90,071,992,547,409.93");
  assert.equal(taxUiAbs(-1250n), 1250n); assert.equal(taxUiMax(0n, -1n), 1n);
  assert.equal(taxUiPercent(1n, 3n), 33.33); assert.equal(taxUiPercent(5n, 2n), 100);
  assert.equal(taxUiPercent(1n, 0n), 0);
});

test("approval thresholds preserve canonical raw document units and nonmoney fields", () => {
  const conditions = taxUiConditions("bill", [{ field: "total", operator: "gte", value: "9223372036854775807" }]);
  assert.deepEqual(conditions, [{ field: "total", operator: "gte", value: "9223372036854775807", valueMinor: "9223372036854775807" }]);
  assert.equal(taxUiConditions("bill", [{ field: "total", operator: "eq", value: "1250", valueMinor: "1250" }])[0].value, "1250");
  for (const value of ["1.25", "01", "-0", "1e3", "9223372036854775808"]) assert.throws(() => taxUiConditions("bill", [{ field: "total", operator: "gt", value }]));
  assert.throws(() => taxUiConditions("bill", [{ field: "total", operator: "eq", value: "1250", valueMinor: "1251" }]));
  assert.throws(() => taxUiConditions("journal_entry", [{ field: "total", operator: "eq", value: "1" }]));
  assert.deepEqual(taxUiConditions("invoice", [{ field: "depositPercent", operator: "eq", value: "1000" }]), [{ field: "depositPercent", operator: "eq", value: "1000" }]);
  assert.deepEqual(taxUiConditions("bill", [{ field: "status", operator: "eq", value: "draft" }]), [{ field: "status", operator: "eq", value: "draft" }]);
});

test("manual FX preserves lossless coexistence instead of rounding decimal input", () => {
  assert.equal(taxUiRate(1234567, "1.234567"), "1.234567");
  assert.equal(taxUiRate(1000000, null), "1");
  assert.deepEqual(taxUiRateInput("1.234567"), { rateExact: "1.234567", rateDirection: "quote_per_base" });
  for (const value of ["1.2345678", "2147.483648", "0", "1oops", "1e3"]) assert.throws(() => taxUiRateInput(value));
  assert.throws(() => taxUiRate(1234567, "1.234568"));
});
