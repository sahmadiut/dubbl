import assert from "node:assert/strict";
import { test } from "node:test";
import { catalogPrices, catalogDto, variantCreateSchema, variantUpdateSchema, supplierCreateSchema, supplierUpdateSchema } from "../lib/api/inventory-catalog-wire";
import { catalogPriceMinor, catalogWholeInput } from "../lib/money/catalog-input";
import { WireCompatibilityError } from "../lib/money/wire";
import { bankMoneyDisplay } from "../lib/money/bank-display";

test("catalog price aliases preserve cents, safe edges and strict canonical inputs", () => {
  assert.deepEqual(catalogPrices(variantCreateSchema.parse({ name: "Large", purchasePrice: 3000000000, purchasePriceMinor: "3000000000", salePriceMinor: "9007199254740991" })),
    { name: "Large", purchasePrice: 3000000000, salePrice: Number.MAX_SAFE_INTEGER });
  assert.equal(catalogPrices(variantUpdateSchema.parse({ purchasePriceMinor: "0" })).purchasePrice, 0);
  for (const v of ["01", "-0", "+1", "1e3", "1.0", " 1", "۱۲", "-1", "9223372036854775808"]) {
    assert.throws(() => catalogPrices(variantCreateSchema.parse({ name: "Bad", purchasePriceMinor: v })));
  }
  for (const v of [-1, -0, 0.5, Number.MAX_SAFE_INTEGER + 1, Infinity, NaN, "1"]) {
    assert.throws(() => variantCreateSchema.parse({ name: "Bad", purchasePrice: v }));
  }
  assert.throws(() => catalogPrices({ purchasePrice: 1, purchasePriceMinor: "2" }));
  assert.throws(() => catalogPrices({ purchasePriceMinor: "9007199254740992" }), WireCompatibilityError);
  assert.throws(() => supplierUpdateSchema.parse({ salePrice: 1 }));
});
test("catalog outputs preserve nullable history and physical units, rejecting unsupported values", () => {
  assert.deepEqual(catalogDto({ purchasePrice: null, salePrice: null, quantityOnHand: -2147483648 }),
    { purchasePrice: null, salePrice: null, quantityOnHand: -2147483648, purchasePriceMinor: null, salePriceMinor: null });
  assert.equal(catalogDto({ purchasePrice: Number.MAX_SAFE_INTEGER }).purchasePriceMinor, "9007199254740991");
  for (const row of [{ purchasePrice: -1 }, { purchasePrice: Number.MAX_SAFE_INTEGER + 1 }, { purchasePrice: 1, quantityOnHand: 2147483648 }, { purchasePrice: 1, leadTimeDays: -1 }]) {
    assert.throws(() => catalogDto(row), WireCompatibilityError);
  }
  assert.equal(variantCreateSchema.parse({ name: "Physical", quantityOnHand: -5 }).quantityOnHand, -5);
  assert.throws(() => variantCreateSchema.parse({ name: "Bad", quantityOnHand: 1.5 }));
  assert.throws(() => supplierCreateSchema.parse({ contactId: "invalid" }));
  assert.throws(() => supplierUpdateSchema.parse({ leadTimeDays: -1 }));
});
test("catalog editors convert decimal cents exactly and reject partial quantities", () => {
  assert.equal(catalogPriceMinor("12.50"), "1250");
  assert.equal(catalogPriceMinor("90071992547409.91"), "9007199254740991");
  assert.equal(bankMoneyDisplay(Number.MAX_SAFE_INTEGER, "USD"), "$90,071,992,547,409.91");
  assert.equal(catalogPriceMinor("0.29"), "29");
  assert.equal(catalogPriceMinor(""), undefined);
  for (const v of ["1.005", "1e3", "-1", "1x", " 1", "01", "90071992547409.92"]) assert.throws(() => catalogPriceMinor(v));
  assert.equal(catalogWholeInput("-2147483648", true), -2147483648);
  assert.equal(catalogWholeInput("2147483647"), 2147483647);
  for (const v of ["1.5", "1day", "1e3", "-0", "01", "-1", "2147483648"]) assert.throws(() => catalogWholeInput(v));
});
