import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BillCurrencyAmounts } from "../components/dashboard/bill-currency-amounts";
import { InvoiceAmountInput } from "../components/dashboard/invoice-amount-input";
import { DualAmount } from "../components/ui/dual-amount";

test("bill overview renders currencies separately and unavailable totals as a dash", () => {
  const html = renderToStaticMarkup(createElement(BillCurrencyAmounts, { amounts: [
    { currencyCode: "USD", amount: 9007199254740993n }, { currencyCode: "KWD", amount: 1251n },
    { currencyCode: "JPY", amount: 1250n }, { currencyCode: "IRR", amount: 1250n },
  ] }));
  assert.match(html, /90,071,992,547,409\.93/); assert.match(html, /KWD 1\.251/);
  assert.match(html, /¥1,250/); assert.match(html, /IRR 1,250/);
  for (const amounts of [null, []]) {
    const missing = renderToStaticMarkup(createElement(BillCurrencyAmounts, { amounts }));
    assert.match(missing, /—/); assert.doesNotMatch(missing, /\$0/);
  }
});

test("bill settlement and base controls render currency scales, exact amounts and English errors", () => {
  for (const [currency, value] of [["JPY", "1250"], ["IRR", "1250"], ["KWD", "1.251"], ["USD", "12.50"]]) {
    const html = renderToStaticMarkup(createElement(InvoiceAmountInput, { currency, value, onChange: () => {} }));
    assert.match(html, new RegExp(`aria-label="Amount in ${currency}"`));
    assert.match(html, /inputMode="decimal"/); assert.doesNotMatch(html, /role="alert"/);
  }
  const invalid = renderToStaticMarkup(createElement(InvoiceAmountInput, { currency: "JPY", value: "1.1", onChange: () => {} }));
  assert.match(invalid, /aria-invalid="true"/); assert.match(invalid, /Enter a positive amount in JPY/);
  const source = renderToStaticMarkup(createElement(DualAmount, { amount: 1250n, currency: "JPY", baseCurrency: "USD", baseAmount: null }));
  assert.match(source, /1,250/); assert.match(source, /— USD/);
});
