import assert from "node:assert/strict";
import { test } from "node:test";
import { purchaseOrderLineSchema, purchaseOrderTotals, purchaseOrderDto, purchaseOrderBillItems,
  purchaseOrderCreateSchema, purchaseOrderUpdateSchema, purchaseOrderConvertSchema, purchaseOrderSendSchema,
  validatePurchaseOrder } from "../lib/api/purchase-order-wire";
import { WireCompatibilityError } from "../lib/money/wire";
import { billCountsDto } from "../lib/api/bill-read-wire";

const id = "00000000-0000-4000-8000-000000000001";
const line = (values: Record<string, unknown> = {}) => purchaseOrderLineSchema.parse({ description: "Item", ...values });
const totals = (values: Record<string, unknown>, currency = "USD") => purchaseOrderTotals([line(values)], currency, new Map());
const saved = { id, description: "Item", quantity: 300, quantityReceived: 0, quantityBilled: 0,
  unitPrice: 37, amount: 100, taxAmount: 10, accountId: null, taxRateId: null, inventoryItemId: null, warehouseId: null, sortOrder: 0 };

test("purchase order price aliases, currencies, exact ratios and PATCH tax units", () => {
  for (const [currency, price] of [["USD", "12.50"], ["JPY", "1250"], ["IRR", "1250"], ["KWD", "1.250"]]) {
    assert.equal(totals({ unitPriceExact: price }, currency).total, 1250);
    assert.equal(totals({ unitPriceMinor: "1250" }, currency).total, 1250);
  }
  assert.equal(totals({ unitPrice: 12.5, unitPriceExact: "12.50", unitPriceMinor: "1250" }).total, 1250);
  assert.equal(totals({ unitPriceExact: "0.005", quantity: 3 }).total, 2);
  assert.equal(totals({ unitPriceExact: "-0.015" }).total, -1);
  assert.equal(totals({ unitPrice: 0.29 }).total, 29);
  assert.equal(totals({}).total, 0);
  const taxed = purchaseOrderTotals([line({ unitPriceMinor: "1250", quantity: 1.5, discountPercent: 1000, taxRateId: id })], "USD", new Map([[id, 1000]]));
  assert.deepEqual([taxed.subtotal, taxed.taxTotal, taxed.total], [1687, 169, 1856]);
  const updated = purchaseOrderTotals([line({ unitPriceMinor: "1250", quantity: 1.5, discountPercent: 1000, taxRateId: id })], "USD", new Map(), true);
  assert.deepEqual([updated.subtotal, updated.taxTotal, updated.total], [1875, 0, 1875]);
  assert.equal(updated.processedLines[0].taxRateId, id);
  assert.equal(purchaseOrderDto(taxed).totalMinor, "1856");
});

test("purchase order conversion preserves net/tax residuals and corrected allocations after void", () => {
  validatePurchaseOrder({ subtotal: 100, taxTotal: 10, total: 110 }, [saved]);
  const partial = purchaseOrderConvertSchema.parse({ lines: [{ purchaseOrderLineId: id, quantity: 1 }] });
  const amounts = [0, 100, 200].map(quantityBilled => purchaseOrderBillItems([{ ...saved, quantityBilled }], partial)[0]);
  assert.deepEqual(amounts.map(item => item.amount), [33, 34, 33]);
  assert.deepEqual(amounts.map(item => item.taxAmount), [3, 4, 3]);
  assert.equal(purchaseOrderBillItems([{ ...saved, quantityBilled: 100 }], {})[0].amount, 67);
  const afterVoid = purchaseOrderBillItems([{ ...saved, quantityBilled: 100 }], partial, new Map([[id, { quantity: 100, amount: 34n, taxAmount: 4n }]]))[0];
  assert.equal(afterVoid.amount, 33); assert.equal(afterVoid.taxAmount, 3);
  assert.throws(() => purchaseOrderBillItems([saved], { lines: [{ purchaseOrderLineId: id, quantity: 1 }, { purchaseOrderLineId: id, quantity: 1 }] }), /Duplicate/);
  assert.throws(() => purchaseOrderBillItems([saved], { lines: [{ purchaseOrderLineId: id, quantity: 0.001 }] }), /positive/);
  assert.throws(() => purchaseOrderBillItems([saved], { lines: [{ purchaseOrderLineId: id, quantity: 4 }] }), /exceed/);
  assert.throws(() => purchaseOrderBillItems([{ ...saved, quantityBilled: 100 }], partial, new Map()), WireCompatibilityError);
  assert.throws(() => validatePurchaseOrder({ subtotal: 99, taxTotal: 10, total: 109 }, [saved]), /balances/);
});

test("purchase order invalid or unsupported prices/products/sums/dates/email reject", () => {
  assert.equal(totals({ unitPriceMinor: String(Number.MAX_SAFE_INTEGER) }).total, Number.MAX_SAFE_INTEGER);
  assert.throws(() => totals({ unitPriceMinor: "9007199254740992" }), WireCompatibilityError);
  assert.throws(() => totals({ unitPriceMinor: String(Number.MAX_SAFE_INTEGER), quantity: 2, discountPercent: 10000 }), WireCompatibilityError);
  assert.throws(() => purchaseOrderTotals([line({ unitPriceMinor: String(Number.MAX_SAFE_INTEGER) }), line({ unitPriceMinor: "1" })], "USD", new Map()), WireCompatibilityError);
  assert.throws(() => totals({ unitPrice: 12.5, unitPriceMinor: "12" }), /disagree/);
  assert.throws(() => totals({ unitPrice: 12.5, unitPriceExact: "12.51" }), /disagree/);
  for (const value of ["01", "1e3", " 1", "1.0", "-0", "۱۲", "9223372036854775808"]) assert.throws(() => line({ unitPriceMinor: value }));
  for (const value of ["01", "1e3", "+1", "1.0000000000000000001", "۱۲"]) assert.throws(() => line({ unitPriceExact: value }));
  assert.throws(() => line({ quantity: 21474836.48 }));
  assert.throws(() => purchaseOrderCreateSchema.parse({ contactId: id, issueDate: "2026-02-30", lines: [line()] }));
  assert.throws(() => purchaseOrderUpdateSchema.parse({ lines: [] }));
  assert.throws(() => purchaseOrderConvertSchema.parse({ lines: [] }));
  assert.throws(() => purchaseOrderSendSchema.parse({ sendEmail: true }));
  assert.throws(() => purchaseOrderSendSchema.parse({ sendEmail: true, recipientEmail: "invalid", subject: "PO", templateProps: {} }));
  assert.equal(purchaseOrderSendSchema.parse({}).sendEmail, false);
});

test("purchase order counts reject unsafe constituents, sums and mixed currency buckets", () => {
  const row = { status: "draft", count: 1, amount: "1250", minAmount: "1250", maxAmount: "1250", currencyCount: 1, currencyCode: "USD" };
  assert.deepEqual(billCountsDto([row]), { counts: { draft: { count: 1, amount: 1250, amountMinor: "1250", currencyCode: "USD" } }, total: 1 });
  for (const change of [{ amount: "9007199254740992" }, { maxAmount: "9007199254740992" }, { minAmount: "-9007199254740992" }, { currencyCount: 2 }])
    assert.throws(() => billCountsDto([{ ...row, ...change }]), WireCompatibilityError);
});
