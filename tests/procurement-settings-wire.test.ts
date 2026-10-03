import assert from "node:assert/strict";
import { test } from "node:test";
import { procurementSettingsUpdateSchema, procurementSettingsDto, validateProcurementControls } from "../lib/api/procurement-settings-wire";
import { WireCompatibilityError } from "../lib/money/wire";

test("procurement controls preserve numeric basis points and boolean flags", () => {
  for (const value of [0, 1, 500, 10000, 100000]) {
    const row = { organizationId: "fixture", priceTolerancePercent: value, qtyTolerancePercent: value,
      requireGrnBeforeBill: false, blockOverBill: true, createdAt: new Date("2026-10-04T00:00:00Z") };
    assert.equal(procurementSettingsDto(row), row);
    assert.deepEqual(validateProcurementControls(row), { priceTolerancePercent: value, qtyTolerancePercent: value,
      requireGrnBeforeBill: false, blockOverBill: true });
    assert.equal(JSON.parse(JSON.stringify(row)).priceTolerancePercent, value);
  }
  assert.deepEqual(procurementSettingsUpdateSchema.parse({ requireGrnBeforeBill: false }), { requireGrnBeforeBill: false });
  assert.deepEqual(procurementSettingsUpdateSchema.parse({}), {});
  // Preserve legacy unknown-field stripping; no aliases or caller-chosen tenant.
  assert.deepEqual(procurementSettingsUpdateSchema.parse({ organizationId: "other", priceTolerancePercentMinor: "500" }), {});
});

test("procurement controls reject coercion, unsupported units and invalid history", () => {
  for (const key of ["priceTolerancePercent", "qtyTolerancePercent"])
    for (const value of [-1, 0.5, 100001, Number.MAX_SAFE_INTEGER, Infinity, NaN, "500", "5%", "۵۰۰", 500n, null, true])
      assert.equal(procurementSettingsUpdateSchema.safeParse({ [key]: value }).success, false);
  for (const key of ["requireGrnBeforeBill", "blockOverBill"])
    for (const value of [null, 0, 1, "false", "true"])
      assert.equal(procurementSettingsUpdateSchema.safeParse({ [key]: value }).success, false);
  for (const input of [null, [], "500"])
    assert.equal(procurementSettingsUpdateSchema.safeParse(input).success, false);
  assert.throws(() => procurementSettingsDto({ priceTolerancePercent: -1, qtyTolerancePercent: 0,
    requireGrnBeforeBill: false, blockOverBill: false }), WireCompatibilityError);
});
