import assert from "node:assert/strict";
import { test } from "node:test";
import { assetMinorPair, assetCategoryCreateSchema, assetCategoryAmounts, assetCreateSchema, assetAmounts, assetMoneyDto, assetMasterQuery } from "../lib/api/asset-master-wire";
import { assetCentsInput, assetCentsDecimal, assetMoneyDisplay, assetLifeInput, assetRateInput } from "../lib/money/asset-display";

test("asset cents aliases agree, reject malformed and unsupported ranges before conversion", () => {
  for (const value of [0, 29, 1250, 3000000000, Number.MAX_SAFE_INTEGER]) assert.equal(assetMinorPair(value, String(value), "cost", true), value);
  assert.throws(() => assetMinorPair(29, "30", "cost"));
  assert.throws(() => assetMinorPair(undefined, undefined, "cost", true));
  for (const value of ["-0", "-1", "01", "1.0", "1e2", " 1", "۱۲", "9223372036854775808", "9007199254740992"]) assert.throws(() => assetMinorPair(undefined, value, "cost"));
  for (const value of [-0, -1, 1.5, NaN, Infinity, 9007199254740992]) assert.throws(() => assetMinorPair(value, undefined, "cost"));
});
test("omitted defaults remain omitted until alias resolution and category inheritance", () => {
  const c = assetCategoryAmounts(assetCategoryCreateSchema.parse({ name: "Template", defaultResidualValueMinor: "1250" }));
  assert.equal(c.defaultResidualValue, 1250); assert.ok(!("defaultResidualValueMinor" in c));
  const input = { name: "Asset", assetNumber: "A1", purchaseDate: "2024-02-29", purchasePriceMinor: "3000000000" };
  const a = assetAmounts(assetCreateSchema.parse(input), true);
  assert.equal(a.purchasePrice, 3000000000); assert.equal(a.residualValue, undefined);
  for (const extra of [{ purchaseDate: "2024-02-30" }, { usefulLifeMonths: 2147483648 }, { totalExpectedUnits: 1.5 }, { currency: "USD" }, { netBookValue: 1 }])
    assert.throws(() => assetCreateSchema.parse({ ...input, ...extra }));
});
test("explicit known saved amounts get signed/nullable aliases; unsafe saved values fail", () => {
  assert.deepEqual(assetMoneyDto({ cost: 1250, change: -29, nullable: null }, ["cost", "change", "nullable"], ["change"]),
    { cost: 1250, costMinor: "1250", change: -29, changeMinor: "-29", nullable: null, nullableMinor: null });
  assert.throws(() => assetMoneyDto({ cost: 9007199254740992 }, ["cost"]));
  assert.throws(() => assetMoneyDto({ cost: -1 }, ["cost"]));
  assert.throws(() => assetMoneyDto({ cost: 1, count: Infinity }, ["cost"]));
});
test("asset queries validate Gregorian-independent filters and pagination", () => {
  assert.equal(assetMasterQuery(new URL("http://test/?isActive=false&limit=200"), true).limit, 200);
  for (const query of ["?isActive=yes", "?limit=201", "?page=1.5", "?page=1000001"]) assert.throws(() => assetMasterQuery(new URL("http://test/" + query), true));
  assert.throws(() => assetMasterQuery(new URL("http://test/?status=unknown")));
});
test("asset input and presentation preserve maximal-safe cents and exact aggregate sums", () => {
  assert.equal(assetCentsInput("0.29"), "29"); assert.equal(assetCentsInput("90071992547409.91"), String(Number.MAX_SAFE_INTEGER));
  assert.equal(assetCentsDecimal(Number.MAX_SAFE_INTEGER), "90071992547409.91");
  assert.equal(assetMoneyDisplay(Number.MAX_SAFE_INTEGER), "$90,071,992,547,409.91");
  assert.equal(assetMoneyDisplay(BigInt(Number.MAX_SAFE_INTEGER) * 2n), "$180,143,985,094,819.82");
  assert.equal(assetMoneyDisplay(-29), "-$0.29");
  for (const input of ["-0.01", "0.001", "1e2", "90071992547409.92"]) assert.throws(() => assetCentsInput(input));
  assert.equal(assetRateInput("20.29"), 2029); assert.equal(assetLifeInput("60"), 60);
  for (const input of ["1.5", "1e2", "0", "2147483648"]) assert.throws(() => assetLifeInput(input));
  for (const input of ["20.291", "1000.01", "1e2"]) assert.throws(() => assetRateInput(input));
});
