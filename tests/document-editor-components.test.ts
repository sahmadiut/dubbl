import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "./helpers/presentation";
import { LineItemsEditor } from "../components/dashboard/line-items-editor";

const row = (unitPrice: string) => ({ description: "Item", quantity: "1", unitPrice, accountId: "", taxRateId: "" });
const render = (currencyCode?: string | null, unitPrice = "12.50") => renderToStaticMarkup(createElement(LineItemsEditor, {
  lines: [row(unitPrice)], onChange: () => {}, currencyCode, roundPriceFirst: true, priceFractionDigits: 18,
}));

test("shared editor renders exact English totals and accessible decimal controls", () => {
  const html = render("USD", "90071992547409.91");
  assert.match(html, /Price \(USD\)/); assert.match(html, /90071992547409\.91<\/span>/);
  assert.match(html, /aria-label="Price for line 1"/); assert.match(html, /aria-label="Quantity for line 1"/);
  assert.match(html, /inputMode="decimal"/); assert.match(html, /step="any"/);
  assert.match(html, /overflow-x-auto/); assert.match(html, /Add line/); assert.match(html, /Subtotal/);
  assert.doesNotMatch(html, /role="alert"/);
});

test("shared compatibility callers keep fixed-two totals while explicit currency follows scale", () => {
  assert.match(render(), /12\.50<\/span>/);
  assert.match(render("JPY", "1250"), /1250<\/span>/);
  assert.match(render("IRR", "1250"), /1250<\/span>/);
  assert.match(render("KWD", "1.251"), /1\.251<\/span>/);
});

test("invalid amounts and unresolved currency show an alert instead of a plausible zero total", () => {
  for (const html of [render(null), render("USD", "1x"), render("USD", "90071992547409.92")]) {
    assert.match(html, /role="alert"/); assert.match(html, /—<\/span>/);
    assert.doesNotMatch(html, />0\.00<\/span>/);
  }
});
