import assert from "node:assert/strict";
import { test } from "node:test";
import { invoiceWriteLineSchema, invoiceWriteTotals, invoicePrice, invoiceRound } from "../lib/api/invoice-write-wire";
import { WireCompatibilityError } from "../lib/money/wire";

const line = (values: Record<string, unknown> = {}) => invoiceWriteLineSchema.parse({ description: "Item", ...values });
const totals = (values: Record<string, unknown>, first = true, currency = "USD") => invoiceWriteTotals([line(values)], currency, first, new Map());

test("invoice price units, exact aliases and signed rounding", () => {
  for (const [currency, price, minor] of [["USD", "12.50", 1250], ["JPY", "1250", 1250], ["IRR", "1250", 1250], ["KWD", "1.250", 1250]] as const) {
    assert.equal(totals({ unitPriceExact: price }, true, currency).total, minor);
    assert.equal(totals({ unitPriceMinor: "1250" }, true, currency).total, 1250);
  }
  assert.equal(invoiceRound(-5n, 10n), 0n); assert.equal(invoiceRound(-15n, 10n), -1n);
  assert.equal(totals({ unitPriceExact: "-0.015" }).total, -1);
  assert.equal(totals({ unitPrice: 0.29 }).total, 29);
  assert.equal(totals({ unitPrice: 1e-7 }).total, 0);
  assert.equal(totals({ unitPrice: 12.5, unitPriceExact: "12.50", unitPriceMinor: "1250" }).total, 1250);
  assert.throws(() => totals({ unitPrice: 12.5, unitPriceExact: "12.51" }), /disagree/);
  assert.throws(() => totals({ unitPrice: 12.5, unitPriceMinor: "12" }), /disagree/);
  for (const value of ["01", "1e3", " 12", "۱۲", "1.0", "-0", "9223372036854775808"]) assert.throws(() => line({ unitPriceMinor: value }));
  for (const value of ["1e3", "+1", "01", "1.0000000000000000001", "NaN"]) assert.throws(() => line({ unitPriceExact: value }));
});

test("invoice rounding order, quantity, discount and tax preserve distinct create/edit contracts", () => {
  assert.equal(totals({ quantity: 3, unitPriceExact: "0.005" }, true).total, 3);
  assert.equal(totals({ quantity: 3, unitPriceExact: "0.005" }, false).total, 2);
  const result = invoiceWriteTotals([line({ quantity: 1.5, unitPriceMinor: "1250", discountPercent: 1000, taxRateId: "00000000-0000-4000-8000-000000000001" })], "USD", true,
    new Map([["00000000-0000-4000-8000-000000000001", 1000]]));
  assert.equal(result.processedLines[0].quantity, 150); assert.equal(result.subtotal, 1687);
  assert.equal(result.taxTotal, 169); assert.equal(result.total, 1856);
  assert.equal(totals({ quantity: 0.333, unitPrice: 1 }).processedLines[0].quantity, 33);
  assert.equal(totals({ quantity: 0.333, unitPrice: 1 }).total, 33);
  assert.equal(totals({}).total, 0);
});

test("invoice guards safe values, gross products, tax and signed sums before persistence", () => {
  const max = String(Number.MAX_SAFE_INTEGER);
  assert.equal(invoicePrice(line({ unitPriceMinor: max }), "USD").minor.toString(), max);
  assert.equal(totals({ unitPriceMinor: max }).total, Number.MAX_SAFE_INTEGER);
  assert.throws(() => totals({ unitPriceMinor: "9007199254740992" }), WireCompatibilityError);
  assert.throws(() => totals({ unitPriceMinor: max, quantity: 2, discountPercent: 10000 }), WireCompatibilityError);
  assert.throws(() => invoiceWriteTotals([line({ unitPriceMinor: max }), line({ unitPriceMinor: "1" })], "USD", true, new Map()), WireCompatibilityError);
  const taxId = "00000000-0000-4000-8000-000000000001";
  assert.throws(() => invoiceWriteTotals([line({ unitPriceMinor: max, taxRateId: taxId })], "USD", true, new Map([[taxId, 10000]])), WireCompatibilityError);
  assert.throws(() => totals({ quantity: 21474836.48 }));
  assert.throws(() => totals({ quantity: NaN }));
  assert.throws(() => invoiceWriteTotals([line({ taxRateId: taxId })], "USD", true, new Map()), /tax rate/);
});
