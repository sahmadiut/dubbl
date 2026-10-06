import assert from "node:assert/strict";
import { test } from "node:test";
import { consolidationReportDto, consolidationWindowSchema } from "../lib/api/consolidation-report-wire";
import { WireCompatibilityError } from "../lib/money/wire";

test("consolidation window accepts real Gregorian dates and rejects malformed, reversed and unsupported inputs", () => {
  const leap = { startDate: "2024-02-29", endDate: "2024-02-29" };
  assert.deepEqual(consolidationWindowSchema.parse(leap), leap);
  for (const input of [{ startDate: "2023-02-29" }, { endDate: "0000-01-01" }, { endDate: "2024-13-01" },
    { startDate: "2024-02-01", endDate: "2024-01-01" }, { startDate: 20240101 }, { currencyCode: "USD" }])
    assert.equal(consolidationWindowSchema.safeParse(input).success, false);
});
test("consolidation wire retains signed safe numeric limits and exact strings without changing metadata or units", () => {
  const safe = BigInt(Number.MAX_SAFE_INTEGER);
  const dto = consolidationReportDto({ presentationCurrency: "JPY", total: safe, net: -safe, count: 2,
    accounts: [{ total: BigInt(0), byEntity: { org: BigInt(-1250) } }],
    rates: [{ rate: 500000, rateExact: "0.5", rateDirection: "quote_per_base" }], byEntity: [] });
  assert.equal(dto.total, Number.MAX_SAFE_INTEGER); assert.equal(dto.totalMinor, "9007199254740991");
  assert.equal(dto.netMinor, "-9007199254740991"); assert.equal(dto.count, 2);
  assert.deepEqual(dto.accounts[0].byEntity, { org: -1250 }); assert.deepEqual(dto.accounts[0].byEntityMinor, { org: "-1250" });
  assert.equal(dto.accounts[0].totalMinor, "0"); assert.equal(dto.presentationCurrency, "JPY");
  assert.deepEqual(dto.byEntity, []); assert.equal(Object.hasOwn(dto, "countMinor"), false);
  assert.deepEqual(dto.rates, [{ rate: 500000, rateExact: "0.5", rateDirection: "quote_per_base" }]);
});
test("consolidation wire classifies unsafe nested totals and int64 overflow before persistence", () => {
  for (const amount of [BigInt("9007199254740992"), BigInt("-9007199254740992"), BigInt("9223372036854775808")])
    assert.throws(() => consolidationReportDto({ accounts: [{ total: amount }] }), WireCompatibilityError);
});
