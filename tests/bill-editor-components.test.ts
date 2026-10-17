import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "./helpers/presentation";
import { LineItemsEditor } from "../components/dashboard/line-items-editor";

const render = (currencyCode: string | null, unitPrice: string, quantity = "1") => renderToStaticMarkup(createElement(LineItemsEditor, {
  lines: [{ description: "Supplier item", unitPrice, quantity, accountId: "", taxRateId: "" }],
  onChange: () => {}, documentKind: "bill", taxContext: "purchase", currencyCode, priceFractionDigits: 18,
}));

test("bill editor renders exact English amount due, extended-price rounding and accessible inputs", () => {
  const html = render("USD", "90071992547409.91");
  assert.match(html, /Amount due/); assert.match(html, /90071992547409\.91<\/span>/);
  assert.match(html, /Price \(USD\)/); assert.match(html, /aria-label="Price for line 1"/);
  assert.match(html, /aria-label="Quantity for line 1"/); assert.match(html, /inputMode="decimal"/);
  assert.match(html, /overflow-x-auto/); assert.doesNotMatch(html, /role="alert"/);
  assert.match(render("USD", "0.005", "3"), /0\.02<\/span>/);
  assert.match(render("JPY", "1250"), /1250<\/span>/);
  assert.match(render("KWD", "1.251"), /1\.251<\/span>/);
});

test("bill unresolved or invalid input suppresses totals and exposes English alerts", () => {
  for (const html of [render(null, "1"), render("USD", "1x"), render("USD", "90071992547409.92")]) {
    assert.match(html, /role="alert"/); assert.match(html, /—<\/span>/);
    assert.doesNotMatch(html, />0\.00<\/span>/);
  }
});
