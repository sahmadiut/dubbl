import assert from "node:assert/strict";
import { test } from "node:test";
import { payrollSettingsUpdateSchema, deductionTypeCreateSchema, employeeDeductionCreateSchema, employeeTaxUpdateSchema,
  taxBracketCreateSchema, taxAllowanceCreateSchema, payrollConfigAmounts, payrollConfigDto, settingsMoney,
  bracketMoney, validateBracket, validateDeductionDates } from "../lib/api/payroll-config-wire";
import { WireCompatibilityError } from "../lib/money/wire";

test("payroll config legacy/exact aliases preserve cents, zero, null and safe bounds", () => {
  for (const value of [0, 29, 1250, 3000000000, Number.MAX_SAFE_INTEGER]) {
    const parsed = deductionTypeCreateSchema.parse({ name: "D", category: "pre_tax", defaultAmount: value, defaultAmountMinor: String(value) });
    const resolved = payrollConfigAmounts(parsed, ["defaultAmount"]);
    assert.equal(resolved.defaultAmount, value); assert.equal("defaultAmountMinor" in resolved, false);
    assert.equal(payrollConfigDto({ ...resolved, defaultPercent: null }, deductionTypeCreateSchema, ["defaultAmount"]).defaultAmountMinor, String(value));
  }
  assert.equal(payrollConfigAmounts(employeeTaxUpdateSchema.parse({ additionalWithholdingMinor: null }), ["additionalWithholding"]).additionalWithholding, null);
  assert.equal(payrollConfigAmounts(payrollSettingsUpdateSchema.parse({ futaWageBaseCentsMinor: "3000000000" }), settingsMoney).futaWageBaseCents, 3000000000);
  assert.equal(payrollConfigAmounts(taxBracketCreateSchema.parse({ name: "B", jurisdictionLevel: "federal", minIncomeMinor: "0", rate: 29 }), bracketMoney, ["minIncome"]).minIncome, 0);
});
test("payroll config rejects unsafe/malformed/conflicting money before DB bridges", () => {
  for (const value of ["01", "-0", "-1", "1.2", "1e3", " 1", "۱۲", "9223372036854775808"])
    assert.throws(() => employeeTaxUpdateSchema.parse({ additionalWithholdingMinor: value }));
  for (const value of [-0, -1, 0.1, Infinity, Number.MAX_SAFE_INTEGER + 1]) assert.throws(() => employeeTaxUpdateSchema.parse({ additionalWithholding: value }));
  for (const input of [{ additionalWithholding: 1, additionalWithholdingMinor: "2" }, { additionalWithholding: null, additionalWithholdingMinor: "0" }, { additionalWithholding: 0, additionalWithholdingMinor: null }])
    assert.throws(() => payrollConfigAmounts(employeeTaxUpdateSchema.parse(input), ["additionalWithholding"]));
  for (const value of ["9007199254740992", "9223372036854775807"])
    assert.throws(() => payrollConfigAmounts(employeeTaxUpdateSchema.parse({ additionalWithholdingMinor: value }), ["additionalWithholding"]), WireCompatibilityError);
  assert.throws(() => payrollConfigAmounts(taxBracketCreateSchema.parse({ name: "B", jurisdictionLevel: "federal", rate: 0 }), bracketMoney, ["minIncome"]));
});
test("payroll rates/counts/hours are explicit and real inputs cannot silently round", () => {
  assert.equal(deductionTypeCreateSchema.parse({ name: "D", category: "post_tax", defaultPercent: 2.5 }).defaultPercent, 2.5);
  for (const value of [-1, 100.5, 2.9, NaN]) assert.throws(() => deductionTypeCreateSchema.parse({ name: "D", category: "post_tax", defaultPercent: value }));
  for (const input of [{ defaultTaxRate: 10001 }, { ssRateBp: 1.5 }, { overtimeMultiplier: 1.1 }, { overtimeThresholdHours: -1 }, { defaultCurrency: "ZZZ" }, { defaultTaxYear: 10000 }, { ssRateBpMinor: "620" }])
    assert.throws(() => payrollSettingsUpdateSchema.parse(input));
  for (const input of [{ federalAllowances: 2147483648 }, { stateAllowances: 1.2 }, { additionalFederalWithholding: 29 }]) assert.throws(() => employeeTaxUpdateSchema.parse(input));
  assert.equal(employeeTaxUpdateSchema.parse({ federalAllowances: 2147483647 }).federalAllowances, 2147483647);
});
test("payroll dates, annual floors and allowance metadata validate without money scaling", () => {
  const base = { deductionTypeId: "11111111-1111-4111-8111-111111111111" };
  assert.throws(() => employeeDeductionCreateSchema.parse({ ...base, startDate: "2024-02-30" }));
  assert.throws(() => validateDeductionDates({ startDate: "2024-03-02", endDate: "2024-03-01" }));
  assert.throws(() => validateBracket({ minIncome: 100, maxIncome: 100 }));
  validateBracket({ minIncome: Number.MAX_SAFE_INTEGER, maxIncome: null });
  assert.equal(taxAllowanceCreateSchema.parse({ jurisdictionLevel: "state", jurisdiction: "CA", taxYear: 2026, allowanceValueCentsMinor: "1250" }).allowanceValueCentsMinor, "1250");
  assert.throws(() => taxAllowanceCreateSchema.parse({ jurisdictionLevel: "state", taxYear: 2026, allowanceValueCents: -1 }));
});
test("saved configuration is guarded before unrelated writes or serialization", () => {
  for (const input of [{ additionalWithholding: -1 }, { additionalWithholding: 9007199254740992 }, { additionalWithholding: 0, federalAllowances: 2147483648 }, { additionalWithholding: 0, filingStatus: "bogus" }])
    assert.throws(() => payrollConfigDto(input, employeeTaxUpdateSchema, ["additionalWithholding"]), WireCompatibilityError);
  assert.deepEqual(payrollConfigDto({ additionalWithholding: null }, employeeTaxUpdateSchema, ["additionalWithholding"]), { additionalWithholding: null, additionalWithholdingMinor: null });
});
