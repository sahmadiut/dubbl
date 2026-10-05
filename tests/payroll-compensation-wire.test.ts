import assert from "node:assert/strict";
import { test } from "node:test";
import { bandCreateSchema, compensationAmounts, compensationDto, validateBand, whatIfSchema, percentBasisPoints, ratioPercent, compensationQuery } from "../lib/api/payroll-compensation-wire";
import { WireCompatibilityError } from "../lib/money/wire";
import { bankMoneyDisplay } from "../lib/money/bank-display";
import { parseMajor } from "../lib/money/exact";

test("compensation aliases preserve cents and fail without lossy coercion", () => {
  for (const amount of [0, 29, 1250, 3000000000, Number.MAX_SAFE_INTEGER]) {
    const p = bandCreateSchema.parse({ name: "Band", minSalaryMinor: String(amount), midSalary: amount, maxSalary: amount, currency: "IRR" });
    assert.equal(compensationAmounts(p, ["minSalary", "midSalary", "maxSalary"], true).minSalary, amount);
    assert.deepEqual(compensationDto({ salary: amount }, ["salary"]), { salary: amount, salaryMinor: String(amount) });
  }
  assert.throws(() => compensationAmounts({ totalBudget: 1, totalBudgetMinor: null }, ["totalBudget"]));
  assert.deepEqual(compensationAmounts({ totalBudgetMinor: null }, ["totalBudget"]), { totalBudget: null });
  for (const alias of ["01", "-0", "1.5", "1e3", " 1", "۱۲۵۰", "-1"]) assert.throws(() => bandCreateSchema.parse({ name: "Bad", minSalaryMinor: alias }));
  assert.throws(() => compensationAmounts({ minSalary: 1, minSalaryMinor: "2" }, ["minSalary"], true));
  assert.throws(() => compensationAmounts({ minSalaryMinor: "9007199254740992" }, ["minSalary"], true), WireCompatibilityError);
  assert.throws(() => validateBand({ minSalary: 10, midSalary: 9, maxSalary: 20, currency: "USD" }));
  assert.throws(() => compensationDto({ salary: NaN }, ["salary"]), WireCompatibilityError);
});
test("forecast quantities and exact percentage rounding are separate from money", () => {
  assert.equal(percentBasisPoints(0.29), 29n); assert.equal(percentBasisPoints(-100), -10000n);
  for (const percent of [0.001, -101, 1001, -0, Infinity]) assert.throws(() => percentBasisPoints(percent));
  for (const input of [{ months: 0 }, { months: 61 }, { newHires: -1 }, { terminations: 1.5 }, { salaryAdjustmentPercent: "10" }]) assert.throws(() => whatIfSchema.parse(input));
  assert.equal(ratioPercent(1n, 3n), 33.33); assert.equal(ratioPercent(-1n, 8n), -12.5);
  assert.deepEqual(compensationQuery(new URL("http://fixture/?months=60"), "months"), { months: 60 });
  for (const value of ["0", "1x", "01", "-1", "1.0", "1e2"]) assert.throws(() => compensationQuery(new URL("http://fixture/?months=" + value), "months"));
});
test("compensation dashboard decimal input and formatting preserve currency precision", () => {
  assert.equal(parseMajor("0.29", "USD", "reject").amountMinor, 29n);
  assert.equal(parseMajor("1250", "IRR", "reject").amountMinor, 1250n);
  assert.equal(parseMajor("1.250", "KWD", "reject").amountMinor, 1250n);
  assert.throws(() => parseMajor("1.001", "USD", "reject"));
  assert.match(bankMoneyDisplay(9007199254740991n, "USD"), /90,071,992,547,409\.91/);
  assert.match(bankMoneyDisplay(-29n, "USD"), /-\$0\.29/);
});
