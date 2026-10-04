import assert from "node:assert/strict";
import { test } from "node:test";
import { adjustmentSchema, validateAdjustment, minorAlias, movementDto, stockTakeLineDto, physicalQuantity, postingDate, transferCreateSchema, lotCreateSchema } from "../lib/api/inventory-movement-wire";
import { WireCompatibilityError } from "../lib/money/wire";

test("inventory movement exact aliases preserve cents, signed deltas and supported range", () => {
  assert.equal(minorAlias({ amount: 1250, amountMinor: "1250" }, "amount"), 1250);
  assert.equal(minorAlias({ amountMinor: "-3000000000" }, "amount"), -3000000000);
  assert.equal(minorAlias({ amountMinor: "9007199254740991" }, "amount"), Number.MAX_SAFE_INTEGER);
  for (const value of ["01", "-0", "+1", "1.0", "1e3", " 1", "۱۲۵۰"]) assert.throws(() => minorAlias({ amountMinor: value }, "amount"));
  assert.throws(() => minorAlias({ amount: 1, amountMinor: "2" }, "amount"));
  assert.throws(() => minorAlias({ amountMinor: "9007199254740992" }, "amount"), WireCompatibilityError);
  assert.throws(() => minorAlias({ amount: -0 }, "amount"));
  const p = adjustmentSchema.parse({ newTotalValueMinor: "1250", adjustmentType: "revaluation", reason: "Test" });
  assert.equal(validateAdjustment(p, "revaluation", "adjustment", "newTotalValue"), 1250);
  assert.throws(() => validateAdjustment({ adjustment: 1, amountMinor: "1" }, "quantity", "adjustment", "amount"));
  assert.throws(() => validateAdjustment({ valueDelta: 1, newTotalValue: 2 }, "write_down", "adjustment", "valueDelta"));
  assert.throws(() => adjustmentSchema.parse({ reason: "Test", adjustment: 1, unknown: 1 }));
});
test("physical quantities and Gregorian dates are distinct from money", () => {
  for (const q of [-2147483648, 0, 2147483647]) assert.equal(physicalQuantity.parse(q), q);
  for (const q of [-0, 1.5, "1", 2147483648, -2147483649]) assert.throws(() => physicalQuantity.parse(q));
  assert.equal(postingDate.parse("2024-02-29"), "2024-02-29");
  for (const d of ["0000-01-01", "2023-02-29", "2026-02-30", "2026-13-01", "2026-1-01", "2026-10-05T00:00:00Z"]) assert.throws(() => postingDate.parse(d));
  const id = "00000000-0000-4000-8000-000000000001";
  assert.throws(() => transferCreateSchema.parse({ fromWarehouseId: id, toWarehouseId: id, lines: [{ inventoryItemId: id, quantity: 1 }] }));
  assert.throws(() => lotCreateSchema.parse({ quantity: 1, manufacturingDate: "2026-10-05", expiryDate: "2026-10-04" }));
});
test("movement and count DTOs preserve signed values/nulls and reject unsupported saved values", () => {
  const row = { unitCost: 3000000000, value: -6000000000, quantity: -2, previousQuantity: 3, newQuantity: 1 };
  assert.deepEqual(movementDto(row), { ...row, unitCostMinor: "3000000000", valueMinor: "-6000000000" });
  assert.throws(() => movementDto({ ...row, value: Number.MAX_SAFE_INTEGER + 1 }), WireCompatibilityError);
  assert.throws(() => movementDto({ ...row, quantity: 1.5 }), WireCompatibilityError);
  const line = { expectedQuantity: 3, countedQuantity: null, discrepancy: null, valueAdjustment: null };
  assert.equal(stockTakeLineDto(line).valueAdjustmentMinor, null);
  assert.equal(stockTakeLineDto({ ...line, valueAdjustment: -3000000000 }).valueAdjustmentMinor, "-3000000000");
});
