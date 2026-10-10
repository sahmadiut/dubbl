import assert from "node:assert/strict";
import { test } from "node:test";
import { generateUblXml, type UblInvoiceData } from "../lib/ubl/generate-ubl";
import { WireCompatibilityError } from "../lib/money/wire";

const sample = (currencyCode: string, amount: number): UblInvoiceData => ({
  invoiceNumber: "INV-001", issueDate: "2024-01-01", dueDate: "2024-01-31", currencyCode,
  supplier: { name: "Supplier", country: "US" }, customer: { name: "Customer", country: "US" },
  subtotal: amount, taxTotal: 0, total: amount,
  lines: [{ id: 1, description: "Exact price", quantity: 1, unitPrice: amount, lineAmount: amount, taxAmount: 0, taxPercent: 0 }],
});
test("UBL currency decimals preserve safe integer edges without float rounding or fixed cents", () => {
  for (const [currency, expected] of [["USD", "90071992547409.91"], ["IRR", "9007199254740991"], ["JPY", "9007199254740991"], ["KWD", "9007199254740.991"]]) {
    const xml = generateUblXml(sample(currency, Number.MAX_SAFE_INTEGER));
    assert.ok(xml.includes(`<cbc:PayableAmount currencyID="${currency}">${expected}</cbc:PayableAmount>`));
    assert.ok(xml.includes(`<cbc:PriceAmount currencyID="${currency}">${expected}</cbc:PriceAmount>`));
  }
  const taxed = sample("USD", 10001); taxed.taxTotal = 1250; taxed.total = 11251;
  assert.ok(generateUblXml(taxed).includes("<cbc:Percent>12.50</cbc:Percent>"));
  assert.throws(() => generateUblXml(sample("USD", Number.MAX_SAFE_INTEGER + 1)), WireCompatibilityError);
  const hidden = sample("USD", 1250); hidden.lines[0].taxAmount = Number.NaN;
  assert.throws(() => generateUblXml(hidden), WireCompatibilityError);
});
