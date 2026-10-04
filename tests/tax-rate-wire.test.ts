import assert from "node:assert/strict";
import { test } from "node:test";
import { taxBasisPoints, taxCreateSchema, taxUpdateSchema, taxProfileSchema, taxJurisdictionSchema, taxRateDto, taxJurisdictionDto } from "../lib/api/tax-rate-wire";
import { WireCompatibilityError, stringifyWire } from "../lib/money/wire";
test("basis points remain bounded numeric integers in legacy and exact serialization", () => {
  for (const rate of [0, 1, 1000, 10000, 2147483647]) {
    const row = taxRateDto({ rate, recoverablePercent: 5000, components: [{ rate }] });
    for (const mode of ["legacy", "exact"] as const) assert.deepEqual(JSON.parse(stringifyWire(row, mode)), row);
    assert.ok(!("rateExact" in row)); assert.ok(!("rateMinor" in row));
  }
  for (const v of [-1, -0, 0.5, 2147483648, Number.MAX_SAFE_INTEGER, NaN, Infinity, "1000", 1000n, null])
    assert.equal(taxBasisPoints.safeParse(v).success, false);
});
test("tax patches preserve omitted fields and reject money/FX aliases", () => {
  assert.deepEqual(taxUpdateSchema.parse({ name: "Renamed" }), { name: "Renamed" });
  assert.equal(taxCreateSchema.parse({ name: "Tax", rate: 1000 }).recoverablePercent, 10000);
  for (const extra of [{ rateExact: "0.1" }, { rateMinor: "1000" }, { recoverablePercent: 10001 }, { components: [{ name: "Bad", rate: 2147483648 }] }, { components: [{ name: "Bad", rate: 1, unknown: 1 }] }])
    assert.throws(() => taxCreateSchema.parse({ name: "Tax", rate: 1000, ...extra }));
  assert.deepEqual(taxUpdateSchema.parse({ components: [] }), { components: [] });
});
test("profiles and jurisdiction fields reject unsupported inputs before DB writes", () => {
  assert.deepEqual(taxProfileSchema.parse({ country: "gb" }), { country: "GB" });
  for (const country of [" GB", "GB ", "1B", "", null]) assert.throws(() => taxProfileSchema.parse({ country }));
  for (const extra of [{ combinedRate: "1000" }, { specialRate: 2147483648 }, { source: "api" }, { amountMinor: "1000" }])
    assert.throws(() => taxJurisdictionSchema.parse({ country: "US", combinedRate: 1000, ...extra }));
});
test("unsupported stored basis points fail visibly without coercion", () => {
  for (const value of [-1, "1000", 1000n, 2147483648, null]) {
    assert.throws(() => taxRateDto({ rate: value as number, recoverablePercent: 10000 }), WireCompatibilityError);
    assert.throws(() => taxRateDto({ rate: 1000, recoverablePercent: 10001 }), WireCompatibilityError);
    assert.throws(() => taxJurisdictionDto({ combinedRate: 1000, stateRate: value as number, countyRate: 0, cityRate: 0, specialRate: 0 }), WireCompatibilityError);
  }
});
