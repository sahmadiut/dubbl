import assert from "node:assert/strict";
import { test } from "node:test";
import { assetRevalueSchema, assetImpairToolSchema, assetDisposeSchema, valuationAmount, disposalAmount, valuationSplit } from "../lib/api/asset-valuation-wire";
import { assetCentsInput } from "../lib/money/asset-display";

test("asset valuation aliases preserve cents and reject noncanonical/unsafe input", () => {
  const date = "2024-02-29";
  assert.equal(valuationAmount(assetRevalueSchema.parse({ date, revaluedAmountMinor: "9007199254740991" })), Number.MAX_SAFE_INTEGER);
  assert.equal(disposalAmount(assetDisposeSchema.parse({ date, disposalAmountMinor: "1250", disposalAmount: 1250 })), 1250);
  assert.equal(assetCentsInput("90071992547409.91"), "9007199254740991");
  for (const amount of ["01", "-0", "-1", "1.0", "1e3", " 1", "۱۲۵۰", "9223372036854775808"]) {
    assert.throws(() => valuationAmount(assetRevalueSchema.parse({ date, revaluedAmountMinor: amount })));
    assert.throws(() => disposalAmount(assetDisposeSchema.parse({ date, disposalAmountMinor: amount })));
  }
  assert.throws(() => valuationAmount(assetRevalueSchema.parse({ date, revaluedAmountMinor: "9007199254740992" })));
  for (const amount of [-1, -0, 1.5, NaN, Infinity, 9007199254740992, "1250"]) assert.throws(() => assetRevalueSchema.parse({ date, revaluedAmount: amount }));
  assert.throws(() => valuationAmount(assetRevalueSchema.parse({ date })));
  assert.throws(() => valuationAmount(assetRevalueSchema.parse({ date, revaluedAmount: 10, revaluedAmountMinor: "11" })));
  for (const input of [{ date: "2024-02-30" }, { date: "2024-2-29" }, { date, idempotencyKey: " " }, { date, currency: "IRR" }, { date, notes: "x".repeat(10001) }, { date, proceedsAccountId: "bad" }]) assert.throws(() => assetRevalueSchema.parse(input));
  assert.ok(assetImpairToolSchema.parse({ date, recoverableAmountMinor: "0" }));
  assert.throws(() => assetImpairToolSchema.parse({ date, revaluedAmount: 1 }));
});
test("signed surplus and P&L splits use exact bigint intermediates and available balances", () => {
  assert.deepEqual(valuationSplit(100, 160, 0n, -40n, false), { change: 60n, equity: 20n, pnl: 40n });
  assert.deepEqual(valuationSplit(160, 90, 20n, 0n, true), { change: -70n, equity: -20n, pnl: -50n });
  const max = Number.MAX_SAFE_INTEGER;
  assert.deepEqual(valuationSplit(0, max, 0n, -9007199254740989n, false), { change: 9007199254740991n, equity: 2n, pnl: 9007199254740989n });
  assert.deepEqual(valuationSplit(max, 0, 9007199254740989n, 0n, true), { change: -9007199254740991n, equity: -9007199254740989n, pnl: -2n });
  for (const args of [[100, 100, 0n, 0n, false], [100, 90, 0n, 0n, false], [100, 110, 0n, 0n, true], [100, 110, -1n, 0n, false], [100, 110, 0n, 1n, false]] as const) assert.throws(() => valuationSplit(args[0], args[1], args[2], args[3], args[4]));
});
