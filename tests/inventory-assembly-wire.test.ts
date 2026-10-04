import assert from "node:assert/strict";
import { test } from "node:test";
import { bomCreateSchema, bomUpdateSchema, bomCosts, bomDto, bomEstimate, componentCreateSchema, componentValues, requiredComponentUnits, assemblyCreateSchema, assemblyUpdateSchema, assemblyBuildSchema } from "../lib/api/inventory-assembly-wire";
import { WireCompatibilityError } from "../lib/money/wire";

const id = "00000000-0000-4000-8000-000000000001";
test("Assembly contracts retain integer minor money and exact aliases with safe bounds", () => {
  assert.equal(bomCosts(bomCreateSchema.parse({ assemblyItemId: id, name: "Kit", laborCostCents: 1250, laborCostCentsMinor: "1250" })).laborCostCents, 1250);
  assert.equal(bomDto({ laborCostCents: 2147483648, overheadCostCents: 0 }).laborCostCentsMinor, "2147483648");
  assert.throws(() => bomCosts(bomUpdateSchema.parse({ laborCostCents: 1, laborCostCentsMinor: "2" })));
  assert.throws(() => bomCosts(bomUpdateSchema.parse({ overheadCostCentsMinor: "9007199254740992" })), WireCompatibilityError);
  for (const value of [-1, -0, 1.5, Infinity, Number.MAX_SAFE_INTEGER + 1]) assert.equal(bomUpdateSchema.safeParse({ laborCostCents: value }).success, false);
  for (const value of ["-0", "01", "1.0", "+1", "1e2", " 1", "۱", "9223372036854775808"])
    assert.equal(bomUpdateSchema.safeParse({ laborCostCentsMinor: value }).success, false);
});
test("Recipe quantities are exact physical decimals, ceiling per line and conserving estimates", () => {
  const p = componentValues(componentCreateSchema.parse({ componentItemId: id, quantity: 0.1, quantityExact: "0.100000", wastagePercent: 10, wastagePercentExact: "10.0" }));
  assert.equal(requiredComponentUnits(p.quantity, p.wastagePercent, 10), 2);
  assert.equal(requiredComponentUnits("0.07", "0", 100), 7); // binary math used to ceil 7.000000000000001
  assert.throws(() => componentValues(componentCreateSchema.parse({ componentItemId: id, quantity: 1, quantityExact: "2" })));
  assert.throws(() => componentValues(componentCreateSchema.parse({ componentItemId: id })));
  for (const value of ["0", "-1", "1e2", "01", "0.0000001", "2147483648", "۱", "NaN", " 1"])
    assert.equal(componentCreateSchema.safeParse({ componentItemId: id, quantity: value }).success, false);
  assert.throws(() => requiredComponentUnits("2147483647", "100", 2));
  assert.equal(componentCreateSchema.safeParse({ componentItemId: id, quantity: 1, wastagePercent: 101 }).success, false);
  const estimate = bomEstimate([{ quantity: "0.1", wastagePercent: "0", componentItem: { purchasePrice: 5 } }, { quantity: "0.1", wastagePercent: "0", componentItem: { purchasePrice: 5 } }], 2, 3);
  assert.equal(estimate.componentCostMinor, "1"); assert.equal(estimate.totalCostMinor, "6");
  assert.throws(() => bomEstimate([{ quantity: "2", wastagePercent: "0", componentItem: { purchasePrice: Number.MAX_SAFE_INTEGER } }], 0, 0), WireCompatibilityError);
});
test("Orders preserve positive whole units, real dates and completion-only lifecycle", () => {
  for (const quantity of [0, -1, 1.5, 2147483648, "1"])
    assert.equal(assemblyCreateSchema.safeParse({ bomId: id, quantity }).success, false);
  assert.equal(assemblyCreateSchema.parse({ bomId: id, quantity: 2147483647 }).quantity, 2147483647);
  assert.equal(assemblyUpdateSchema.safeParse({ status: "completed" }).success, false);
  assert.equal(assemblyBuildSchema.safeParse({ date: "2024-02-29" }).success, true);
  for (const date of ["2025-02-29", "2026-13-01", "2026-1-01", "today", "2026-10-05T00:00:00Z"])
    assert.equal(assemblyBuildSchema.safeParse({ date }).success, false);
  assert.equal(assemblyBuildSchema.safeParse({ quantity: 2 }).success, false);
});
