import assert from "node:assert/strict";
import { test } from "node:test";
import { assetCwipCostSchema, assetCapitalizeSchema, cwipAmount } from "../lib/api/asset-cwip-wire";
import { assetCentsInput, assetMoneyDisplay } from "../lib/money/asset-display";

const base = { date: "2024-02-29", sourceAccountId: "00000000-0000-4000-8000-000000000001" };
test("CWIP positive cents aliases preserve safe numeric compatibility and reject malformed/unsupported values", () => {
  for (const value of [1, 1250, Number.MAX_SAFE_INTEGER]) {
    assert.equal(cwipAmount(assetCwipCostSchema.parse({ ...base, amount: value })), value);
    assert.equal(cwipAmount(assetCwipCostSchema.parse({ ...base, amountMinor: String(value) })), value);
    assert.equal(cwipAmount(assetCwipCostSchema.parse({ ...base, amount: value, amountMinor: String(value) })), value);
  }
  for (const amount of [0, -0, -1, 1.5, "1250", Infinity, NaN, 9007199254740992]) assert.throws(() => cwipAmount(assetCwipCostSchema.parse({ ...base, amount })));
  for (const amountMinor of ["0", "-1", "-0", "01", "1.0", "1e3", " 1", "۱", "9007199254740992", "9223372036854775808"]) assert.throws(() => cwipAmount(assetCwipCostSchema.parse({ ...base, amountMinor })));
  assert.throws(() => cwipAmount(assetCwipCostSchema.parse(base)));
  assert.throws(() => cwipAmount(assetCwipCostSchema.parse({ ...base, amount: 1250, amountMinor: "1251" })));
  for (const date of ["0000-01-01", "2024-02-30", "2023-02-29", "2024-1-1", "2024-01-01T00:00:00Z"]) assert.throws(() => assetCapitalizeSchema.parse({ date }));
  assert.throws(() => assetCapitalizeSchema.parse({ date: base.date, currency: "IRR" }));
  assert.throws(() => assetCapitalizeSchema.parse({ date: base.date, idempotencyKey: " " }));
});
test("Construction cost editor uses exact fixed cents parsing and bigint display sums", () => {
  assert.equal(assetCentsInput("12.50"), "1250");
  assert.equal(assetCentsInput("90071992547409.91"), "9007199254740991");
  for (const value of ["1.005", "1e3", "-1", " 1", "90071992547409.92"]) assert.throws(() => assetCentsInput(value));
  assert.equal(assetMoneyDisplay(9007199254740991n + 1n), "$90,071,992,547,409.92");
});
