import assert from "node:assert/strict";
import { test } from "node:test";
import { taxPeriodRange, taxReturnLineDto, taxSettlementSchema, taxSettlementAmount, taxPeriodFileSchema, taxSafeMinor } from "../lib/api/tax-period-wire";
import { stringifyWire } from "../lib/money/wire";
test("tax minor aliases preserve numeric compatibility and reject precision loss", () => {
  const bankGlAccountId = "00000000-0000-4000-8000-000000000001";
  for (const amount of [0, 1250, Number.MAX_SAFE_INTEGER]) {
    assert.equal(taxSettlementAmount(taxSettlementSchema.parse({ bankGlAccountId, amount, amountMinor: String(amount) })), amount);
    const dto = taxReturnLineDto({ amount });
    for (const representation of ["legacy", "exact"] as const) assert.deepEqual(JSON.parse(stringifyWire(dto, representation)), { amount, amountMinor: String(amount) });
  }
  for (const input of [{ amount: 1, amountMinor: "2" }, {}, { amountMinor: "9007199254740992" }, { amountMinor: "9223372036854775807" }])
    assert.throws(() => taxSettlementAmount(taxSettlementSchema.parse({ bankGlAccountId, ...input })));
  for (const amountMinor of ["01", "-0", "1.0", "1e3", " 1", "۱۲۵۰", "-1"]) assert.equal(taxSettlementSchema.safeParse({ bankGlAccountId, amountMinor }).success, false);
  for (const amount of [1.5, Infinity, NaN, -1, -0, 9007199254740992]) assert.equal(taxSettlementSchema.safeParse({ bankGlAccountId, amount }).success, false);
  for (const aggregate of [9007199254740992n, 9223372036854775808n, -9223372036854775809n]) assert.throws(() => taxSafeMinor(aggregate), /safe Number/);
  assert.throws(() => taxReturnLineDto({ amount: 9007199254740992 }));
  assert.deepEqual(taxReturnLineDto({ amount: -1250 }), { amount: -1250, amountMinor: "-1250" });
});
test("tax dates, basis points and strict fields retain their own units", () => {
  taxPeriodRange("2024-02-29", "2024-03-01");
  for (const [start, end] of [["2025-02-29", "2025-03-01"], ["2026-03-02", "2026-03-01"], ["2026-1-01", "2026-02-01"]]) assert.throws(() => taxPeriodRange(start, end));
  assert.equal(taxPeriodFileSchema.parse({ flatRatePercent: 2147483647 }).flatRatePercent, 2147483647);
  for (const input of [{ flatRatePercent: 2147483648 }, { flatRatePercent: "1000" }, { flatRatePercent: 0 }, { basis: "other" }, { netMinor: "1" }]) assert.equal(taxPeriodFileSchema.safeParse(input).success, false);
});
