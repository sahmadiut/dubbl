import assert from "node:assert/strict";
import { test } from "node:test";
import { priceItemCreateSchema, priceItemUpdateSchema, pricingAmounts, priceItemDto, priceListCreateSchema, priceListDto, validatePriceWindow, priceResolveSchema } from "../lib/api/pricing-wire";
import { WireCompatibilityError } from "../lib/money/wire";
const id = "00000000-0000-4000-8000-000000000001";
test("pricing cents aliases preserve zero, safe maximum and agreement", () => {
  for (const value of [0, 1250, Number.MAX_SAFE_INTEGER]) {
    assert.equal(pricingAmounts(priceItemCreateSchema.parse({ inventoryItemId: id, unitPrice: value }), true).unitPrice, value);
    assert.equal(pricingAmounts(priceItemCreateSchema.parse({ inventoryItemId: id, unitPriceMinor: String(value) }), true).unitPrice, value);
    assert.equal(pricingAmounts(priceItemCreateSchema.parse({ inventoryItemId: id, unitPrice: value, unitPriceMinor: String(value) }), true).unitPrice, value);
    assert.equal(priceItemDto({ unitPrice: value, minQuantity: 1 }).unitPriceMinor, String(value));
  }
  assert.deepEqual(pricingAmounts(priceItemUpdateSchema.parse({})), {});
  assert.throws(() => pricingAmounts(priceItemCreateSchema.parse({ inventoryItemId: id }), true));
  assert.throws(() => pricingAmounts(priceItemCreateSchema.parse({ inventoryItemId: id, unitPrice: 1250, unitPriceMinor: "1251" }), true));
  assert.throws(() => pricingAmounts(priceItemCreateSchema.parse({ inventoryItemId: id, unitPriceMinor: "9007199254740992" }), true), WireCompatibilityError);
});
test("pricing rejects noncanonical money, quantity coercion and unknown input", () => {
  for (const unitPriceMinor of ["-1", "-0", "01", "+1", "1.0", "1e3", " 1", "۱۲۵۰", "9223372036854775808"]) assert.equal(priceItemCreateSchema.safeParse({ inventoryItemId: id, unitPriceMinor }).success, false);
  for (const unitPrice of [-1, -0, 1.1, "1250", Number.MAX_SAFE_INTEGER + 1, Infinity]) assert.equal(priceItemCreateSchema.safeParse({ inventoryItemId: id, unitPrice }).success, false);
  for (const minQuantity of [0, -1, 1.5, "1", 2147483648]) assert.equal(priceItemCreateSchema.safeParse({ inventoryItemId: id, unitPrice: 1, minQuantity }).success, false);
  assert.equal(priceItemCreateSchema.safeParse({ inventoryItemId: id, unitPrice: 1, currencyCode: "USD" }).success, false);
  assert.equal(priceResolveSchema.safeParse({ inventoryItemId: id, quantity: 2147483647 }).success, true);
});
test("pricing dates are Gregorian inclusive windows, not instants", () => {
  assert.equal(priceListCreateSchema.parse({ name: "List", currencyCode: " usd " }).currencyCode, "USD");
  for (const date of ["0000-01-01", "2024-02-30", "2023-02-29", "2024-01-01T00:00:00Z", "2024-1-1"]) assert.equal(priceListCreateSchema.safeParse({ name: "List", effectiveFrom: date }).success, false);
  validatePriceWindow({ effectiveFrom: "2024-02-29", effectiveTo: "2024-02-29" });
  assert.throws(() => validatePriceWindow({ effectiveFrom: "2024-03-01", effectiveTo: "2024-02-29" }));
  assert.equal(priceListCreateSchema.safeParse({ name: "List", currencyCode: "XYZ" }).success, false);
});
test("saved pricing rejects unsafe values and unsupported metadata", () => {
  for (const unitPrice of [-1, Number.MAX_SAFE_INTEGER + 1, NaN]) assert.throws(() => priceItemDto({ unitPrice, minQuantity: 1 }), WireCompatibilityError);
  assert.throws(() => priceItemDto({ unitPrice: 1, minQuantity: 0 }), WireCompatibilityError);
  assert.throws(() => priceListDto({ currencyCode: "usd", effectiveFrom: null, effectiveTo: null }), WireCompatibilityError);
  assert.throws(() => priceListDto({ currencyCode: "USD", effectiveFrom: "2024-02-01", effectiveTo: "2024-01-01" }), WireCompatibilityError);
});
