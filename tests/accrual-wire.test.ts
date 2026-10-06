import assert from "node:assert/strict";
import { test } from "node:test";
import { accrualInput, accrualPeriods } from "../lib/api/accrual-wire";

const common = { accountId: "00000000-0000-4000-8000-000000000001", reverseAccountId: "00000000-0000-4000-8000-000000000002",
  startDate: "2024-01-31", endDate: "2024-04-30", periods: 3, description: "Exact" };
test("accrual transport units, decimal rounding, alias agreement and safe range", () => {
  assert.equal(accrualInput({ ...common, totalAmount: 12.5 }, "rest").values.totalAmount, 1250);
  assert.equal(accrualInput({ ...common, totalAmount: 1250 }, "mcp").values.totalAmount, 1250);
  assert.equal(accrualInput({ ...common, totalAmount: 1.005, totalAmountExact: "1.005", totalAmountMinor: "101" }, "rest").values.totalAmount, 101);
  assert.equal(accrualInput({ ...common, totalAmountExact: "90071992547409.91" }, "rest").values.totalAmount, Number.MAX_SAFE_INTEGER);
  for (const input of [{ totalAmountMinor: "9007199254740992" }, { totalAmount: 12.5, totalAmountMinor: "12" },
    { totalAmount: 12.5, totalAmountExact: "12.50001" }, { totalAmountMinor: "01" }, { totalAmountMinor: "-0" },
    { totalAmountExact: "0.001" }, { totalAmountExact: "1e3" }, { totalAmountMinor: "9223372036854775808" }])
    assert.throws(() => accrualInput({ ...common, ...input }, "rest"));
  assert.throws(() => accrualInput({ ...common, totalAmount: 1.1 }, "mcp"));
});
test("accrual allocation conserves large exact totals and legacy UTC month overflow", () => {
  const rows = accrualPeriods(Number.MAX_SAFE_INTEGER, common.startDate, common.endDate, 3);
  assert.equal(rows.reduce((s, r) => s + BigInt(r.amount), 0n), 9007199254740991n);
  assert.deepEqual(rows.map(r => r.periodDate), ["2024-01-31", "2024-03-02", "2024-03-31"]);
  assert.deepEqual(accrualPeriods(2, "2024-01-01", "2024-03-01", 3).map(r => r.amount), [0, 0, 2]);
  for (const args of [[1250, "2024-02-30", "2024-04-01", 2], [1250, "2024-01-31", "2024-02-29", 2],
    [1250, "9999-12-01", "9999-12-31", 2], [1250, "2024-01-01", "2024-02-01", 1201]] as const)
    assert.throws(() => accrualPeriods(args[0], args[1], args[2], args[3]));
});
