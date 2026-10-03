import assert from "node:assert/strict";
import { test } from "node:test";
import { billWriteLineSchema, billWriteTotals, billCreateSchema, billUpdateSchema, billWriteDto } from "../lib/api/bill-write-wire";
import { WireCompatibilityError } from "../lib/money/wire";

const tax = "00000000-0000-4000-8000-000000000001";
const line = (values: Record<string, unknown> = {}) => billWriteLineSchema.parse({ description: "Item", ...values });
const totals = (values: Record<string, unknown>, currency = "USD") => billWriteTotals([line(values)], currency, new Map(), new Map());

test("bill exact and legacy price units, aliases and extended signed rounding", () => {
  for (const [currency, price] of [["USD", "12.50"], ["JPY", "1250"], ["IRR", "1250"], ["KWD", "1.250"]]) {
    assert.equal(totals({ unitPriceExact: price }, currency).total, 1250);
    assert.equal(totals({ unitPriceMinor: "1250" }, currency).total, 1250);
  }
  assert.equal(totals({ unitPrice: 12.5, unitPriceExact: "12.50", unitPriceMinor: "1250" }).total, 1250);
  assert.equal(totals({ quantity: 3, unitPriceExact: "0.005" }).total, 2);
  assert.equal(totals({ unitPriceExact: "-0.015" }).total, -1);
  assert.equal(totals({ unitPrice: 0.29 }).total, 29);
  assert.equal(totals({ unitPrice: 1e-7 }).total, 0);
  assert.equal(totals({}).total, 0);
  const rounded = totals({ quantity: 0.333, unitPrice: 1 });
  assert.equal(rounded.total, 33); assert.equal(rounded.processedLines[0].quantity, 33);
  assert.throws(() => totals({ unitPrice: 12.5, unitPriceExact: "12.51" }), /disagree/);
  assert.throws(() => totals({ unitPrice: 12.5, unitPriceMinor: "12" }), /disagree/);
  for (const value of ["01", "1e3", " 12", "۱۲", "1.0", "-0", "9223372036854775808"]) assert.throws(() => line({ unitPriceMinor: value }));
  for (const value of ["1e3", "+1", "01", "1.0000000000000000001", "NaN"]) assert.throws(() => line({ unitPriceExact: value }));
});

test("bill discount, exclusive and reverse-charge tax retain component units", () => {
  const values = [line({ quantity: 1.5, unitPriceMinor: "1250", discountPercent: 1000, taxRateId: tax, goodsReceiptLineId: tax })];
  const normal = billWriteTotals(values, "USD", new Map([[tax, 1000]]), new Map([[tax, "normal"]]));
  assert.equal(normal.subtotal, 1687); assert.equal(normal.taxTotal, 169); assert.equal(normal.total, 1856); assert.equal(normal.amountDue, 1856);
  assert.equal(normal.processedLines[0].goodsReceiptLineId, tax); assert.equal(normal.processedLines[0].discountPercent, 1000);
  const reverse = billWriteTotals(values, "USD", new Map([[tax, 1000]]), new Map([[tax, "reverse_charge"]]));
  assert.equal(reverse.total, 1856); assert.equal(reverse.amountDue, 1687);
  const dto = billWriteDto({ ...reverse, amountPaid: 0 });
  assert.equal(dto.amountDueMinor, "1687"); assert.equal(dto.taxTotalMinor, "169");
});

test("bill safe workflow limits and validation reject before persistence", () => {
  const max = String(Number.MAX_SAFE_INTEGER);
  assert.equal(totals({ unitPriceMinor: max }).total, Number.MAX_SAFE_INTEGER);
  assert.throws(() => totals({ unitPriceMinor: "9007199254740992" }), WireCompatibilityError);
  assert.throws(() => totals({ unitPriceMinor: max, quantity: 2, discountPercent: 10000 }), WireCompatibilityError);
  assert.throws(() => billWriteTotals([line({ unitPriceMinor: max }), line({ unitPriceMinor: "1" })], "USD", new Map(), new Map()), WireCompatibilityError);
  assert.throws(() => billWriteTotals([line({ unitPriceMinor: max, taxRateId: tax })], "USD", new Map([[tax, 10000]]), new Map()), WireCompatibilityError);
  assert.throws(() => totals({ quantity: 21474836.48 })); assert.throws(() => totals({ quantity: NaN }));
  assert.throws(() => billWriteTotals([line({ taxRateId: tax })], "USD", new Map(), new Map()), /tax rate/);
  const basic = { contactId: tax, issueDate: "2026-10-03", dueDate: "2026-10-31", lines: [line()] };
  assert.throws(() => billCreateSchema.parse({ ...basic, issueDate: "2026-02-30" }));
  assert.throws(() => billCreateSchema.parse({ ...basic, purchaseOrderIds: ["foreign text"] }));
  assert.throws(() => billUpdateSchema.parse({ lines: [] }));
  assert.throws(() => billWriteDto({ subtotal: Number.MAX_SAFE_INTEGER + 1, taxTotal: 0, total: 0, amountPaid: 0, amountDue: 0 }));
});
