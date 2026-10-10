import assert from "node:assert/strict";
import { test } from "node:test";
import { documentMoneyText, documentSum, documentHundredths, documentRenderDto, renderQuery } from "../lib/documents/render-wire";
import { generateDocumentHtml } from "../lib/documents/pdf-generator";
import { WireCompatibilityError } from "../lib/money/wire";

const doc = { documentNumber: "DOC-1", issueDate: "2024-01-01", contactName: "Customer <&>", currencyCode: "USD",
  subtotal: 1250, taxTotal: 0, total: 1250, lines: [{ description: "Line <&>", quantity: 100, unitPrice: 1250, taxAmount: 0, amount: 1250 }] };
test("document render text preserves every signed minor digit and currency scale", () => {
  assert.equal(documentMoneyText(Number.MAX_SAFE_INTEGER, "USD"), "$90,071,992,547,409.91");
  assert.equal(documentMoneyText(-1, "USD"), "-$0.01");
  for (const currencyCode of ["USD", "IRR", "JPY", "KWD"]) {
    const dto = documentRenderDto({ ...doc, currencyCode });
    assert.equal(dto.total, 1250); assert.equal(dto.totalMinor, "1250"); assert.equal(dto.lines[0].amountMinor, "1250");
    const html = generateDocumentHtml("invoice", dto, { name: "Org" }, {});
    assert.ok(html.includes(documentMoneyText(1250, currencyCode))); assert.match(html, /Line &lt;&amp;&gt;/);
  }
  assert.match(documentMoneyText(1250, "IRR"), /1,250/);
  assert.match(documentMoneyText(1250, "KWD"), /1\.250/);
});
test("render guards reject hidden tax, quantity, currency and unsafe money before HTML", () => {
  for (const value of [NaN, Infinity, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => generateDocumentHtml("quote", { ...doc, taxTotal: value }, { name: "Org" }, { showTaxBreakdown: false }), WireCompatibilityError);
    assert.throws(() => documentRenderDto({ ...doc, lines: [{ ...doc.lines[0], taxAmount: value }] }), WireCompatibilityError);
    assert.throws(() => documentRenderDto({ ...doc, lines: [{ ...doc.lines[0], quantity: value }] }), WireCompatibilityError);
  }
  assert.throws(() => documentRenderDto({ ...doc, currencyCode: "XXX" }), WireCompatibilityError);
});
test("derived display sums and physical hundredths remain exact", () => {
  assert.equal(documentSum(Number.MAX_SAFE_INTEGER, -Number.MAX_SAFE_INTEGER, 1), 1);
  assert.throws(() => documentSum(Number.MAX_SAFE_INTEGER, 1), WireCompatibilityError);
  assert.equal(documentHundredths(Number.MAX_SAFE_INTEGER), "90071992547409.91");
  assert.equal(documentHundredths(-1), "-0.01");
});
test("render format rejects unknown and duplicate controls", () => {
  assert.equal(renderQuery(new Request("http://fixture/render")), "html");
  for (const query of ["format=csv", "format=html&format=pdf", "currencyCode=USD"]) assert.throws(() => renderQuery(new Request(`http://fixture/render?${query}`)));
});
