import assert from "node:assert/strict";
import { test } from "node:test";
import { allocateInventoryCost, inventoryLayerValue } from "../lib/money/inventory-cost";
import { landedAmount, landedCreateSchema, landedTotal } from "../lib/api/landed-cost-wire";
import { layerDto, consumptionDto } from "../lib/api/inventory-valuation-wire";

test("landed costs preserve legacy two-decimal major inputs with exact aliases and reject unsupported range", () => {
  const component = (input: object) => landedCreateSchema.parse({ name: "Freight", components: [{ description: "Freight", ...input }] }).components[0];
  assert.equal(landedAmount(component({ amount: 1.005 })), 101);
  assert.equal(landedAmount(component({ amount: 12.50, amountMinor: "1250" })), 1250);
  assert.equal(landedAmount(component({ amountMinor: "9007199254740991" })), Number.MAX_SAFE_INTEGER);
  assert.throws(() => landedAmount(component({ amount: 12.50, amountMinor: "12" })));
  for (const value of ["01", "-0", "-1", "1e3", "1.0", " 1", "۱۲۵۰"])
    assert.throws(() => component({ amountMinor: value }));
  assert.throws(() => landedAmount(component({ amountMinor: "9007199254740992" })));
  assert.throws(() => landedAmount(component({})));
  assert.throws(() => landedTotal([component({ amountMinor: "9007199254740991" }), component({ amountMinor: "1" })]));
  for (const method of ["by_weight", "manual"]) assert.throws(() => landedCreateSchema.parse({ name: "X", allocationMethod: method, components: [component({ amount: 1 })] }));
});
test("largest-remainder allocation conserves every cent deterministically with exact intermediates", () => {
  assert.deepEqual(allocateInventoryCost(1, [1, 1, 1]), [1, 0, 0]);
  assert.deepEqual(allocateInventoryCost(2, [1, 1, 1]), [1, 1, 0]);
  assert.deepEqual(allocateInventoryCost(5, [1, 3, 0]), [1, 4, 0]);
  assert.deepEqual(allocateInventoryCost(Number.MAX_SAFE_INTEGER, [Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER]), [4503599627370496, 4503599627370495]);
  assert.throws(() => allocateInventoryCost(1, [0, 0]));
  for (let amount = 0; amount < 60; amount++) for (let a = 0; a < 7; a++) for (let b = 1; b < 7; b++) {
    const result = allocateInventoryCost(amount, [a, b, 2]);
    assert.equal(result.reduce((s, v) => s + v, 0), amount);
    assert.ok(result.every(v => Number.isSafeInteger(v) && v >= 0));
    if (a === 0) assert.equal(result[0], 0);
  }
});
test("historical FIFO money derives unchanged; new carrying/consumed values preserve residuals", () => {
  const historical = { originalQuantity: 3, remainingQuantity: 2, unitCost: 29, remainingValue: null };
  assert.equal(inventoryLayerValue(historical), 58);
  assert.equal(layerDto(historical).remainingValueMinor, "58");
  assert.equal(layerDto({ ...historical, remainingValue: 59 }).unitCostMinor, "29");
  assert.equal(layerDto({ ...historical, remainingValue: 59 }).remainingValueMinor, "59");
  assert.equal(consumptionDto({ quantity: 2, unitCost: 29, value: 59 }).valueMinor, "59");
  assert.equal(consumptionDto({ quantity: 2, unitCost: 29, value: null }).valueMinor, "58");
  assert.throws(() => layerDto({ ...historical, remainingQuantity: 4 }));
  assert.throws(() => inventoryLayerValue({ ...historical, remainingValue: -1 }));
});
