import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DualAmount } from "../components/ui/dual-amount";
import { InvoiceAmountInput } from "../components/dashboard/invoice-amount-input";

test("invoice controls render exact English source/base currencies and input validation", () => {
  const dual = renderToStaticMarkup(createElement(DualAmount, { amount: 9007199254740991n, currency: "USD", baseCurrency: "KWD", baseAmount: 1250n }));
  assert.match(dual, /\$90,071,992,547,409\.91/); assert.match(dual, /KWD 1\.250/);
  const unavailable = renderToStaticMarkup(createElement(DualAmount, { amount: 1250n, currency: "JPY", baseCurrency: "USD", baseAmount: null }));
  assert.match(unavailable, /1,250/); assert.match(unavailable, /— USD/);
  for (const [currency, value] of [["JPY", "1250"], ["KWD", "1.250"], ["USD", "90071992547409.91"]]) {
    const html = renderToStaticMarkup(createElement(InvoiceAmountInput, { currency, value, onChange: () => {} }));
    assert.match(html, new RegExp(`aria-label="Amount in ${currency}"`));
    assert.match(html, /inputMode="decimal"/); assert.doesNotMatch(html, /role="alert"/);
  }
  const invalid = renderToStaticMarkup(createElement(InvoiceAmountInput, { currency: "JPY", value: "1.1", onChange: () => {} }));
  assert.match(invalid, /aria-invalid="true"/); assert.match(invalid, /role="alert"/);
  assert.match(invalid, /Enter a positive amount in JPY/);
});
