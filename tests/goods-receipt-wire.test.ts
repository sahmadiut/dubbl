import assert from "node:assert/strict";
import { test } from "node:test";
import { goodsReceiptCreateSchema, goodsReceiptQuantity, goodsReceiptAmount, goodsReceiptLineDto } from "../lib/api/goods-receipt-wire";

test("receipt quantities keep physical units, exact aliases and int32 hundredths", () => {
  assert.equal(goodsReceiptQuantity({ quantity: 1.005 }, false), 101);
  assert.equal(goodsReceiptQuantity({ quantityExact: "1.005" }, false), 101);
  assert.equal(goodsReceiptQuantity({ quantity: 2, quantityExact: "2.00" }, true), 200);
  assert.equal(goodsReceiptQuantity({ quantityExact: "21474836.47" }, false), 2147483647);
  for (const input of [{}, { quantity: 0.001 }, { quantityExact: "21474836.475" }, { quantity: 1, quantityExact: "2" }])
    assert.throws(() => goodsReceiptQuantity(input, false));
  assert.throws(() => goodsReceiptQuantity({ quantityExact: "1.001" }, true));
  for (const value of ["1e2", "01", "-0", "۱", " 1", "1.", "-1"])
    assert.equal(goodsReceiptCreateSchema.safeParse({ purchaseOrderId: "00000000-0000-4000-8000-000000000001",
      date: "2026-10-04", lines: [{ purchaseOrderLineId: "00000000-0000-4000-8000-000000000002", quantityExact: value }] }).success, false);
});
test("receipt extended costs round exact minor units and reject unsafe sums/products", () => {
  assert.equal(goodsReceiptAmount(101, 1250), 1263);
  assert.equal(goodsReceiptAmount(100, Number.MAX_SAFE_INTEGER), Number.MAX_SAFE_INTEGER);
  assert.throws(() => goodsReceiptAmount(200, Number.MAX_SAFE_INTEGER));
  for (const cost of [-1, 1.5, Infinity, Number.MAX_SAFE_INTEGER + 1]) assert.throws(() => goodsReceiptAmount(100, cost));
  assert.deepEqual(goodsReceiptLineDto({ quantityReceived: 101, unitCost: 1250 }),
    { quantityReceived: 101, quantityReceivedExact: "1.01", unitCost: 1250, unitCostMinor: "1250" });
});
