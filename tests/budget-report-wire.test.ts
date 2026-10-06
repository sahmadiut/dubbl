import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { budgetReportQuery, budgetReportSchema, budgetReportRound, budgetReportMoney, budgetReportActual,
  budgetReportCurrency, budgetReportDates, budgetReportStoredAmount } from "../lib/api/budget-report-wire";
import { WireCompatibilityError } from "../lib/money/wire";

test("budget report percentages/projections round exact signed ratios with legacy ties", () => {
  for (const [n, d, result] of [[1n, 2n, 1n], [-1n, 2n, 0n], [-3n, 2n, -1n], [3n, -2n, -1n], [-3n, -2n, 2n]]) {
    assert.equal(budgetReportRound(n, d), result);
  }
  assert.equal(budgetReportRound(9007199254740991n * 3n, 3n), 9007199254740991n);
  assert.throws(() => budgetReportRound(1n, 0n));
  for (const type of ["asset", "expense"]) assert.equal(budgetReportActual(type, { debit: 9007199254741000n, credit: 9007199254740999n }), 1n);
  for (const type of ["revenue", "liability", "equity"]) assert.equal(budgetReportActual(type, { debit: 1n, credit: 3n }), 2n);
  assert.equal(budgetReportActual("asset"), 0n);
  assert.throws(() => budgetReportActual("unknown"), WireCompatibilityError);
});

test("budget report monetary aliases remain signed safe fixed cents without currency rescaling", () => {
  for (const value of [0n, 1250n, -1250n, 9007199254740991n, -9007199254740991n]) {
    const result = budgetReportMoney({ actual: value });
    assert.equal(result.actual, Number(value)); assert.equal(result.actualMinor, String(value));
  }
  for (const value of [9007199254740992n, -9007199254740992n]) assert.throws(() => budgetReportMoney({ actual: value }), WireCompatibilityError);
  for (const value of [NaN, Infinity, 1.5, Number.MAX_SAFE_INTEGER + 1]) assert.throws(() => budgetReportStoredAmount(value), WireCompatibilityError);
  for (const currency of ["USD", "IRR", "JPY", "KWD"]) assert.equal(budgetReportCurrency(currency), currency);
  for (const currency of ["usd", "XYZ", ""]) assert.throws(() => budgetReportCurrency(currency), WireCompatibilityError);
});

test("budget report uses canonical UTC days, bounded elapsed time and inclusive duration", () => {
  assert.deepEqual(budgetReportDates("2024-03-01", "2024-03-31", new Date("2024-03-02T11:59:59Z")), { totalDays: 31, daysElapsed: 1, daysRemaining: 30 });
  assert.equal(budgetReportDates("2024-03-01", "2024-03-31", new Date("2024-03-02T12:00:00Z")).daysElapsed, 2);
  assert.equal(budgetReportDates("2024-03-01", "2024-03-31", new Date("2024-02-01Z")).daysElapsed, 0);
  assert.equal(budgetReportDates("2024-03-01", "2024-03-31", new Date("2025-02-01Z")).daysElapsed, 31);
  assert.equal(budgetReportDates("0001-01-01", "0001-01-01", new Date("0001-01-01T00:00:00Z")).totalDays, 1);
  for (const [start, end] of [["2024-02-30", "2024-03-01"], ["2024-03-02", "2024-03-01"], ["0000-01-01", "2024-01-01"]])
    assert.throws(() => budgetReportDates(start, end, new Date()), WireCompatibilityError);
});

test("budget report query validates UUID, duplicates and unknown parameters before queries", () => {
  const id = randomUUID();
  assert.deepEqual(budgetReportQuery(new Request(`http://fixture.test/?budgetId=${id}`)), { budgetId: id });
  assert.deepEqual(budgetReportSchema.parse({}), {});
  for (const query of ["budgetId=", "budgetId=invalid", `budgetId=${id}&budgetId=${id}`, "format=json", "amountMinor=1"])
    assert.throws(() => budgetReportQuery(new Request(`http://fixture.test/?${query}`)));
});
