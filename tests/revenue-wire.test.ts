import assert from "node:assert/strict";
import { test } from "node:test";
import { revenueInput, revenuePeriods } from "../lib/api/revenue-wire";

const common = { invoiceId: "00000000-0000-4000-8000-000000000001", startDate: "2024-01-31", endDate: "2024-03-31" };
test("revenue transport units, decimal rounding, alias agreement and safe range", () => {
  assert.equal(revenueInput({ ...common, totalAmount: 12.5 }, "rest").values.totalAmount, 1250);
  assert.equal(revenueInput({ ...common, totalAmount: 1250 }, "mcp").values.totalAmount, 1250);
  assert.equal(revenueInput({ ...common, totalAmount: 1.005, totalAmountExact: "1.005", totalAmountMinor: "101" }, "rest").values.totalAmount, 101);
  assert.equal(revenueInput({ ...common, totalAmountExact: "90071992547409.91" }, "rest").values.totalAmount, Number.MAX_SAFE_INTEGER);
  for (const input of [{ totalAmountMinor: "9007199254740992" }, { totalAmount: 12.5, totalAmountMinor: "12" },
    { totalAmount: 12.5, totalAmountExact: "12.50001" }, { totalAmountMinor: "01" }, { totalAmountMinor: "-0" },
    { totalAmountExact: "0.001" }, { totalAmountExact: "1e3" }, { totalAmountMinor: "9223372036854775808" }])
    assert.throws(() => revenueInput({ ...common, ...input }, "rest"));
  assert.throws(() => revenueInput({ ...common, totalAmount: 1.1 }, "mcp"));
});
test("revenue allocation conserves large exact totals and legacy UTC month overflow", () => {
  const rows = revenuePeriods(Number.MAX_SAFE_INTEGER, common.startDate, common.endDate);
  assert.equal(rows.reduce((s, r) => s + BigInt(r.amount), 0n), 9007199254740991n);
  assert.deepEqual(rows.map(r => r.periodDate), ["2024-01-31", "2024-03-02", "2024-03-31"]);
  assert.deepEqual(revenuePeriods(2, "2024-01-01", "2024-03-01").map(r => r.amount), [0, 0, 2]);
  assert.deepEqual(revenuePeriods(100, "2024-01-31", "2024-02-29").map(r => r.periodDate), ["2024-01-31", "2024-03-02"]);
  for (const args of [[1250, "2024-02-30", "2024-04-01"], [1250, "2024-04-01", "2024-03-31"],
    [1250, "0000-01-01", "0000-01-01"], [1250, "2024-01-01", "2124-01-01"]] as const)
    assert.throws(() => revenuePeriods(args[0], args[1], args[2]));
});
