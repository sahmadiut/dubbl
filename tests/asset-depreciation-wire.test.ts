import assert from "node:assert/strict";
import { test } from "node:test";
import { calculateDepreciation as dep, calculateMonthlyDepreciation as monthly, applyConvention } from "../lib/fixed-assets/depreciation";
import { assetDepreciationSchema, assetDepreciationBatchSchema, assetDepreciationRollbackSchema, readDepreciationJson } from "../lib/api/asset-depreciation-wire";

test("depreciation intermediates remain exact at maximal safe amounts and int32 life/usage", () => {
  const max = Number.MAX_SAFE_INTEGER, n = 2147483647;
  const round = (a: bigint, b: bigint) => Number((a + b / 2n) / b);
  assert.equal(dep("sum_of_years_digits", max, 0, n, 0), round(BigInt(max) * BigInt(n), BigInt(n) * BigInt(n + 1) / 2n));
  assert.equal(dep("declining_balance", max, 0, 60, 0), round(BigInt(max) * 2n, 60n));
  assert.equal(dep("units_of_production", max, 0, 60, 0, 0, { unitsThisPeriod: n - 1, totalExpectedUnits: n }), round(BigInt(max) * BigInt(n - 1), BigInt(n)));
  assert.equal(dep("straight_line", 1, 0, 2, 0), 1);
  for (const method of ["straight_line", "declining_balance", "sum_of_years_digits"]) {
    let total = 0;
    for (let i = 0; i < 60; i++) total += dep(method, 125003, 1000, 60, i, total);
    assert.equal(total, 124003);
  }
  assert.throws(() => dep("straight_line", 9007199254740992, 0, 1, 0));
  assert.throws(() => dep("straight_line", 10, 8, 1, 0, 3));
});
test("timing conventions, Gregorian leap proration and terminal residual are exact", () => {
  const asset = { purchasePrice: 101, residualValue: 1, usefulLifeMonths: 2, depreciationMethod: "straight_line", accumulatedDepreciation: 0, purchaseDate: "2024-02-29", periodIndex: 0 };
  for (const convention of ["mid_month", "half_year", "mid_quarter", "pro_rata_days"]) {
    const first = monthly({ ...asset, convention, periodDate: "2024-02-29" });
    const final = monthly({ ...asset, convention, periodDate: "2024-03-31", accumulatedDepreciation: first, periodIndex: 1 });
    assert.equal(first + final, 100);
  }
  assert.equal(monthly({ ...asset, convention: "full_at_purchase" }), 100);
  assert.equal(monthly({ ...asset, periodDate: "2024-02-28" }), 0);
  assert.equal(applyConvention(29, "pro_rata_days", 0, "2024-02-29", "2024-02-29", false), 1);
  assert.equal(applyConvention(31, "pro_rata_days", 0, "2024-01-31", "2024-01-31", false), 1);
  assert.throws(() => monthly({ ...asset, purchaseDate: "2024-02-30" }));
  assert.throws(() => dep("unknown", 100, 0, 12, 0));
});
test("depreciation wire distinguishes physical units, dates and retry inputs", async () => {
  assert.deepEqual(assetDepreciationSchema.parse({}), {});
  for (const bad of [{ unitsThisPeriod: -1 }, { unitsThisPeriod: 1.5 }, { unitsThisPeriod: 2147483648 }, { unitsThisPeriod: "1" },
    { date: "2024-02-30" }, { date: "2024-2-29" }, { amountMinor: "1250" }, { idempotencyKey: "" }, { idempotencyKey: "a b" }]) assert.throws(() => assetDepreciationSchema.parse(bad));
  assert.throws(() => assetDepreciationBatchSchema.parse({ unitsThisPeriod: 1 }));
  assert.throws(() => assetDepreciationRollbackSchema.parse({ depreciationEntryId: "invalid" }));
  assert.deepEqual(await readDepreciationJson(new Request("http://fixture.test", { method: "POST" })), {});
  await assert.rejects(() => readDepreciationJson(new Request("http://fixture.test", { method: "POST", body: "{" })));
});
