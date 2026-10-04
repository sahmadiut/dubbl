import assert from "node:assert/strict";
import { test } from "node:test";
import { expenseTaxSplit, expensePaySchema, expenseRejectSchema } from "../lib/api/expense-lifecycle-wire";

test("Expense tax-inclusive and reverse-charge splits conserve gross using exact rounding", () => {
  assert.deepEqual(expenseTaxSplit(1100, { rate: 1000, recoverablePercent: 10000, kind: "standard" }), { expense: 1000, input: 100, output: 0 });
  assert.deepEqual(expenseTaxSplit(1100, { rate: 1000, recoverablePercent: 5000, kind: "partial_block" }), { expense: 1050, input: 50, output: 0 });
  assert.deepEqual(expenseTaxSplit(1000, { rate: 1000, recoverablePercent: 5000, kind: "reverse_charge" }), { expense: 1050, input: 50, output: 100 });
  for (const kind of ["blocked", "exempt", "no_vat", "sales_tax_us"])
    assert.deepEqual(expenseTaxSplit(1100, { rate: 1000, recoverablePercent: 10000, kind }), { expense: 1100, input: 0, output: 0 });
  for (const amount of [0, 1, 5, 37, 10001, Number.MAX_SAFE_INTEGER]) {
    const result = expenseTaxSplit(amount, { rate: 1000, recoverablePercent: 5000, kind: "standard" });
    assert.equal(BigInt(result.expense) + BigInt(result.input), BigInt(amount));
  }
  assert.deepEqual(expenseTaxSplit(3, { rate: 10000, recoverablePercent: 5000, kind: "partial_block" }), { expense: 2, input: 1, output: 0 });
  assert.throws(() => expenseTaxSplit(Number.MAX_SAFE_INTEGER, { rate: 2147483647, recoverablePercent: 0, kind: "reverse_charge" }));
  for (const amount of [-1, 0.1, Number.MAX_SAFE_INTEGER + 1]) assert.throws(() => expenseTaxSplit(amount));
  assert.throws(() => expenseTaxSplit(1, { rate: 1000, recoverablePercent: 10001, kind: "standard" }));
});
test("Expense lifecycle inputs require valid dates, strict fields and nonblank reasons", () => {
  assert.deepEqual(expensePaySchema.parse({ date: "2026-10-04" }), { date: "2026-10-04", bankAccountCode: "1100" });
  for (const input of [{ date: "2026-02-30" }, { date: "2026-10-04", amountMinor: "1" }]) assert.equal(expensePaySchema.safeParse(input).success, false);
  assert.equal(expenseRejectSchema.safeParse({ reason: "  " }).success, false);
  assert.equal(expenseRejectSchema.parse({ reason: " Correction " }).reason, "Correction");
});
