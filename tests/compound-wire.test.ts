import assert from "node:assert/strict";
import { test } from "node:test";
import { compoundDates, compoundDual, compoundRatio, compoundQuery, trackingSchema } from "../lib/reports/compound-wire";
import { WireCompatibilityError } from "../lib/money/wire";

test("compound inputs reject invalid dates, enums, duplicate and unknown parameters", () => {
  for (const q of ["startDate=2024-02-30", "mode=wrong", "dimension=wrong", "basis=wrong", "startDate=2024-01-01&startDate=2024-01-01", "amountMinor=1"]) {
    assert.throws(() => compoundQuery(new Request(`http://test/?${q}`), "tracking-category"));
  }
  assert.throws(() => compoundDates({ startDate: "2025-01-01", endDate: "2024-01-01" }));
  assert.equal(trackingSchema.parse({ dimension: "project" }).dimension, "project");
  assert.equal(compoundQuery(new Request("http://test/"), "pack").format, "xlsx");
  assert.throws(() => compoundQuery(new Request("http://test/?format=pdf"), "pack"));
  assert.throws(() => compoundQuery(new Request("http://test/?format=json"), "financial-ratios"));
});
test("compound money projection retains signed amounts, aligned aliases and ordinary metadata", () => {
  assert.deepEqual(compoundDual({ amounts: [1n, -1n], totals: [], count: 2, label: "a", total: 0n }),
    { amounts: [1, -1], amountsMinor: ["1", "-1"], totals: [], totalsMinor: [], count: 2, label: "a", total: 0, totalMinor: "0" });
  assert.equal(compoundDual({ amount: BigInt(Number.MAX_SAFE_INTEGER) }).amountMinor, String(Number.MAX_SAFE_INTEGER));
  assert.throws(() => compoundDual({ totals: [9007199254740992n] }), WireCompatibilityError);
});
test("ratios round exact operands and signed ties, reject lossy output, and retain zero-divisor nulls", () => {
  assert.deepEqual(compoundRatio(1n, 8n), { value: 0.13, exact: "0.13" });
  assert.deepEqual(compoundRatio(-1n, 8n), { value: -0.12, exact: "-0.12" });
  assert.deepEqual(compoundRatio(1n, -8n), { value: -0.12, exact: "-0.12" });
  assert.deepEqual(compoundRatio(-1n, -8n), { value: 0.13, exact: "0.13" });
  assert.deepEqual(compoundRatio(9223372036854775807n, 9223372036854775806n), { value: 1, exact: "1.00" });
  assert.deepEqual(compoundRatio(1n, 8n, true), { value: 12.5, exact: "12.50" });
  assert.deepEqual(compoundRatio(1n, 2n, false, 1), { value: 1, exact: "1" });
  assert.deepEqual(compoundRatio(-1n, 2n, false, 1), { value: 0, exact: "0" });
  assert.deepEqual(compoundRatio(1n, 0n), { value: null, exact: null });
  assert.throws(() => compoundRatio(9007199254740991n, 1n), WireCompatibilityError);
  assert.throws(() => compoundRatio(9007199254740990n, 100n), WireCompatibilityError);
});
