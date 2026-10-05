import assert from "node:assert/strict";
import { test } from "node:test";
import { runCreateSchema, bonusCreateSchema, correctionRunSchema, runAmount, runQuery, runMoneyDto, runItemDto } from "../lib/api/payroll-run-wire";
import { payrollConvert, payrollPercent, payrollRatio, payrollLegacyRate, payrollSum, payrollInteger } from "../lib/payroll/exact";
import { computeExactPeriodWithholding, computeFica, computeEmployerTaxes } from "../lib/api/payroll-tax";
import { WireCompatibilityError } from "../lib/money/wire";
const id = "11111111-1111-4111-8111-111111111111";

test("Payroll run aliases retain signed/positive cents, strict types and bounded legacy compatibility", () => {
  for (const value of [29, 1250, 3000000000, Number.MAX_SAFE_INTEGER]) {
    assert.equal(runAmount(bonusCreateSchema.parse({ employeeId: id, bonusType: "other", amount: value })), value);
    assert.equal(runAmount(bonusCreateSchema.parse({ employeeId: id, bonusType: "other", amountMinor: String(value) })), value);
  }
  assert.equal(runAmount({ grossAdjustmentMinor: "-1250" }, "grossAdjustment"), -1250);
  assert.throws(() => runAmount({ amount: 29, amountMinor: "30" }));
  assert.throws(() => runAmount({ amountMinor: "9007199254740992" }), WireCompatibilityError);
  for (const amountMinor of ["-0", "01", "1.0", "1e3", "+1", " 1", "۱۲۵۰"]) assert.equal(bonusCreateSchema.safeParse({ employeeId: id, bonusType: "other", amountMinor }).success, false);
  for (const amount of [-0, 0, -1, 12.5, "1250", NaN, Infinity, 9007199254740992]) assert.equal(bonusCreateSchema.safeParse({ employeeId: id, bonusType: "other", amount }).success, false);
  assert.equal(bonusCreateSchema.safeParse({ employeeId: id, bonusType: "other", amount: 29, organizationId: id }).success, false);
  assert.equal(correctionRunSchema.safeParse({ parentRunId: id, adjustments: [{ employeeId: id, grossAdjustment: -29 }] }).success, true);
});
test("Run dates, types, exact hour units and pagination do not silently coerce", () => {
  const period = { payPeriodStart: "2024-02-01", payPeriodEnd: "2024-02-29" };
  assert.ok(runCreateSchema.safeParse({ ...period, runType: "off_cycle" }).success);
  for (const value of ["termination", "bonus_only", "correction", "bogus"]) assert.equal(runCreateSchema.safeParse({ ...period, runType: value }).success, false);
  for (const value of ["0000-01-01", "2023-02-29", "2024-2-01", "2024-02-01T00:00:00Z"]) assert.equal(runCreateSchema.safeParse({ ...period, payPeriodStart: value }).success, false);
  for (const query of ["page=1x", "limit=101", "status=bogus", "page=0", "limit=1e2"]) assert.throws(() => runQuery(new URL("http://test?" + query)));
  assert.equal(payrollPercent(1250, 2.5), 31);
  assert.throws(() => payrollPercent(1250, 2.9), WireCompatibilityError);
});
test("Exact salary, overtime, percentages, signed corrections and FX round only final rational cents", () => {
  assert.equal(payrollRatio(Number.MAX_SAFE_INTEGER, 1n, 12n), 750599937895083);
  assert.equal(payrollRatio(29, 1n, 2n), 15);
  assert.equal(payrollRatio(-29, 1n, 2n), -15);
  assert.equal(payrollConvert(29, "1.5"), 44);
  assert.equal(payrollConvert(-29, "1.5"), -44);
  assert.equal(payrollConvert(Number.MAX_SAFE_INTEGER, "0.000000000000000029"), 0);
  assert.throws(() => payrollConvert(Number.MAX_SAFE_INTEGER, "1.5"), WireCompatibilityError);
  assert.equal(payrollSum([Number.MAX_SAFE_INTEGER, -Number.MAX_SAFE_INTEGER, 29]), 29);
  assert.throws(() => payrollSum([Number.MAX_SAFE_INTEGER, 1]), WireCompatibilityError);
});
test("Progressive tax annualization, allowances and FICA caps use exact bigint intermediates", () => {
  const result = computeExactPeriodWithholding({ annualTaxableWage: payrollInteger(Number.MAX_SAFE_INTEGER) * 12n,
    payPeriodsPerYear: 12, brackets: [{ minIncome: 0, rate: 29 }], allowances: 2147483647, allowanceValueCents: Number.MAX_SAFE_INTEGER });
  assert.equal(result.taxableAfterDeductions, 0n); assert.equal(result.periodWithholding, 0);
  const regular = computeExactPeriodWithholding({ annualTaxableWage: 120000n, payPeriodsPerYear: 12, brackets: [{ minIncome: 0, maxIncome: 60000, rate: 1000 }, { minIncome: 60000, rate: 2000 }], additionalWithholding: 29 });
  assert.equal(regular.periodWithholding, 1529); assert.equal(regular.annualTax, 18000n);
  assert.throws(() => computeExactPeriodWithholding({ annualTaxableWage: 100n, payPeriodsPerYear: 12, brackets: [{ minIncome: 0, rate: 29 }, { minIncome: 0, rate: 30 }] }), WireCompatibilityError);
  const fica = computeFica({ periodWage: Number.MAX_SAFE_INTEGER, ytdWage: Number.MAX_SAFE_INTEGER - 29, ssWageBaseCents: Number.MAX_SAFE_INTEGER,
    ssRateBp: 5000, medicareRateBp: 0, addlMedicareThresholdCents: Number.MAX_SAFE_INTEGER, addlMedicareRateBp: 0 });
  assert.equal(fica.socialSecurity, 15); assert.equal(fica.total, 15);
  assert.equal(computeEmployerTaxes({ periodWage: 29, ytdWage: 0, employerFicaEnabled: true, ssWageBaseCents: 29, ssRateBp: 5000, medicareRateBp: 0, futaRateBp: 0, futaWageBaseCents: 0, sutaRateBp: 0, sutaWageBaseCents: 0 }).total, 15);
});
test("Legacy decimal real FX is reconstructed only when lossless; exact snapshots are authoritative", () => {
  assert.equal(payrollLegacyRate(1.25), "1.25");
  assert.equal(payrollLegacyRate(0.5), "0.5");
  assert.throws(() => payrollLegacyRate(Math.fround(1.2)), WireCompatibilityError);
  const item = { currency: "USD", overtimeHours: null, fxRate: Math.fround(1.2), rateExact: "1.2", rateMigrationStatus: "exact", rateFormatVersion: 1, rateDirection: "quote_per_base", grossAmount: 1250, taxAmount: 29, deductions: 29, netAmount: 1221 };
  assert.equal(runItemDto(item).rateExact, "1.2");
  assert.equal(runItemDto(item).grossAmountMinor, "1250");
  assert.throws(() => runItemDto({ ...item, rateMigrationStatus: "quarantined" }), WireCompatibilityError);
  assert.throws(() => runItemDto({ ...item, rateExact: null, rateMigrationStatus: "pending" }), WireCompatibilityError);
});
test("Saved money DTOs reject unsafe nested history before commit", () => {
  assert.equal(runMoneyDto({ amount: -29 }, ["amount"]).amountMinor, "-29");
  assert.equal(runMoneyDto({ amount: null }, ["amount"]).amountMinor, null);
  assert.throws(() => runMoneyDto({ amount: 9007199254740992 }, ["amount"]), WireCompatibilityError);
  assert.throws(() => runMoneyDto({ amount: 29, employee: { salary: 9007199254740992 } }, ["amount"]), WireCompatibilityError);
});
