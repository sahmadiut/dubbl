import { z } from "zod";
import { currencyCodeSchema } from "@/lib/currency/zod";
import { exactMinorSchema, legacyMinorSchema, legacyMinor, stringifyWire, WireCompatibilityError } from "@/lib/money/wire";
import { payrollDate } from "./payroll-master-wire";

export const payrollConfigId = z.string().uuid().describe("Organization-owned live configuration or employee UUID");
const text = z.string().max(10000);
const name = text.min(1).describe("Configuration name");
const cents = legacyMinorSchema.min(0).refine(v => !Object.is(v, -0), "Negative zero is not canonical");
const exact = exactMinorSchema.refine(v => !v.startsWith("-"), "Cents must be nonnegative");
const money = cents.optional().describe("Nonnegative integer cents, max 9007199254740991; never decimal major units");
const moneyAlias = exact.optional().describe("Canonical nonnegative integer cents string; same safe range; must agree with numeric field");
const nullableMoney = cents.nullable().optional().describe("Nonnegative safe integer cents; null clears, omitted retains");
const nullableAlias = exact.nullable().optional().describe("Canonical nonnegative safe cents string; null clears; must agree including null");
const bp = z.number().int().min(0).max(10000).describe("Integer basis points 0..10000, 100 = 1%; not cents or decimal percent");
// These columns are PostgreSQL real. Reject writes that would silently change in storage.
const real = z.number().finite().refine(v => !Object.is(v, -0) && Math.fround(v) === v, "Value must be exactly representable in PostgreSQL real (binary32)");
const percent = real.min(0).max(100).nullable().optional().describe("Decimal percent of gross, 0..100, exactly binary32 representable (e.g. 2.5); null clears; not basis points or money");
const year = z.number().int().min(1).max(9999).describe("Gregorian tax year, 1..9999");
const status = z.enum(["single", "married_joint", "married_separate", "head_of_household"]);
const jurisdiction = {
  jurisdictionLevel: z.enum(["federal", "state", "local"]).describe("Tax jurisdiction level; configuration metadata, not a statutory rule"),
  jurisdiction: text.min(1).nullable().optional().describe("Optional jurisdiction label/code; null is the default schedule"),
};
export const payrollSettingsUpdateSchema = z.object({
  defaultTaxRate: bp.optional().describe("Fallback employee tax rate in basis points, 0..10000"),
  overtimeThresholdHours: real.min(0).optional().describe("Nonnegative binary32 hours before overtime; not money"),
  overtimeMultiplier: real.min(1).optional().describe("Binary32 overtime factor at least 1; not a percent or money"),
  defaultCurrency: currencyCodeSchema.optional().describe("ISO payroll currency; existing cents never rescale"),
  salaryExpenseAccountCode: text.min(1).nullable().optional().describe("Owned active salary expense account code; null clears"),
  taxPayableAccountCode: text.min(1).nullable().optional().describe("Owned active tax liability account code; null clears"),
  bankAccountCode: text.min(1).nullable().optional().describe("Owned active bank asset account code; null clears"),
  autoApprovalEnabled: z.boolean().optional().describe("Enable automatic approval"),
  ssWageBaseCents: money, ssWageBaseCentsMinor: moneyAlias,
  ssRateBp: bp.optional().describe("Employee/employer Social Security rate in basis points"),
  medicareRateBp: bp.optional().describe("Medicare rate in basis points"),
  addlMedicareThresholdCents: money, addlMedicareThresholdCentsMinor: moneyAlias,
  addlMedicareRateBp: bp.optional().describe("Additional Medicare rate in basis points"),
  employerFicaEnabled: z.boolean().optional().describe("Enable employer FICA matching"),
  futaRateBp: bp.optional().describe("FUTA rate in basis points"), futaWageBaseCents: money, futaWageBaseCentsMinor: moneyAlias,
  sutaRateBp: bp.optional().describe("SUTA rate in basis points"), sutaWageBaseCents: money, sutaWageBaseCentsMinor: moneyAlias,
  defaultTaxYear: year.nullable().optional().describe("Default Gregorian tax year; null uses the payroll period year"),
}).strict();
export const deductionTypeCreateSchema = z.object({ name,
  description: text.nullable().optional().describe("Description; null clears"),
  category: z.enum(["pre_tax", "post_tax"]).describe("Tax treatment"),
  defaultAmount: nullableMoney, defaultAmountMinor: nullableAlias, defaultPercent: percent,
}).strict();
export const deductionTypeUpdateSchema = deductionTypeCreateSchema.partial().extend({
  isActive: z.boolean().optional().describe("Active flag"),
}).strict();
export const employeeDeductionCreateSchema = z.object({
  deductionTypeId: payrollConfigId.describe("Live deduction type UUID owned by the employee's organization"),
  timing: z.enum(["recurring", "one_time"]).optional().describe("Timing; defaults recurring"),
  amount: nullableMoney, amountMinor: nullableAlias, percent,
  startDate: payrollDate.nullable().optional().describe("Gregorian YYYY-MM-DD start date; null clears"),
  endDate: payrollDate.nullable().optional().describe("Gregorian YYYY-MM-DD end date, at or after start; null clears"),
}).strict();
export const employeeDeductionUpdateSchema = employeeDeductionCreateSchema.omit({ deductionTypeId: true }).extend({
  isActive: z.boolean().optional().describe("Active flag"),
}).strict();
export const taxBracketCreateSchema = z.object({ name, ...jurisdiction,
  filingStatus: status.nullable().optional().describe("Filing status; null applies to all"),
  taxYear: year.nullable().optional().describe("Gregorian tax year; null is year-agnostic"),
  minIncome: money, minIncomeMinor: moneyAlias, maxIncome: nullableMoney, maxIncomeMinor: nullableAlias,
  rate: bp,
  baseAmountCents: nullableMoney, baseAmountCentsMinor: nullableAlias,
  standardDeductionCents: nullableMoney, standardDeductionCentsMinor: nullableAlias,
}).strict();
export const taxBracketUpdateSchema = taxBracketCreateSchema.partial().extend({ isActive: z.boolean().optional().describe("Active flag") }).strict();
export const taxAllowanceCreateSchema = z.object({ ...jurisdiction, taxYear: year,
  allowanceValueCents: money, allowanceValueCentsMinor: moneyAlias,
  standardDeductionCents: money, standardDeductionCentsMinor: moneyAlias,
}).strict();
export const taxAllowanceUpdateSchema = taxAllowanceCreateSchema.partial().strict();
export const employeeTaxUpdateSchema = z.object({
  filingStatus: status.optional().describe("Employee filing status; default single"),
  federalAllowances: z.number().int().min(0).max(2147483647).optional().describe("Nonnegative int32 allowance count; not money"),
  stateAllowances: z.number().int().min(0).max(2147483647).optional().describe("Nonnegative int32 allowance count; not money"),
  additionalWithholding: nullableMoney, additionalWithholdingMinor: nullableAlias,
  exempt: z.boolean().optional().describe("Employee income-tax exemption"),
}).strict();
export const settingsMoney = ["ssWageBaseCents", "addlMedicareThresholdCents", "futaWageBaseCents", "sutaWageBaseCents"] as const;
export const bracketMoney = ["minIncome", "maxIncome", "baseAmountCents", "standardDeductionCents"] as const;
export const allowanceMoney = ["allowanceValueCents", "standardDeductionCents"] as const;

/** Resolve aliases before entering a writer. No numeric coercion of decimal money. */
export function payrollConfigAmounts<T extends object>(input: T, fields: readonly string[], required: readonly string[] = []): T {
  const values = { ...input } as Record<string, unknown>;
  for (const field of fields) {
    const numeric = values[field], alias = values[field + "Minor"];
    if (numeric !== undefined && alias !== undefined && alias !== (numeric === null ? null : String(numeric)))
      throw new z.ZodError([{ code: "custom", path: [field + "Minor"], message: "Money aliases disagree" }]);
    if (alias !== undefined) values[field] = alias === null ? null : legacyMinor(BigInt(alias as string));
    delete values[field + "Minor"];
    if (required.includes(field) && values[field] === undefined)
      throw new z.ZodError([{ code: "custom", path: [field], message: `Provide ${field} or ${field}Minor` }]);
  }
  return values as T;
}
export function payrollConfigDto<T extends object>(row: T, schema: z.ZodObject, fields: readonly string[]) {
  try {
    const saved = row as Record<string, unknown>;
    schema.parse(Object.fromEntries(Object.keys(schema.shape).filter(k => !k.endsWith("Minor") && k in saved).map(k => [k, saved[k]])));
    const aliases = Object.fromEntries(fields.map(field => {
      const value = saved[field];
      cents.nullable().parse(value);
      return [field + "Minor", value === null ? null : String(value)];
    }));
    const result = { ...row, ...aliases }; stringifyWire(result); return result;
  } catch { throw new WireCompatibilityError("Unsupported saved payroll configuration money, rate or metadata"); }
}
export function validateDeductionDates(row: { startDate?: string | null; endDate?: string | null }) {
  if (row.startDate && row.endDate && row.endDate < row.startDate) throw new z.ZodError([{ code: "custom", path: ["endDate"], message: "End date cannot precede start date" }]);
}
export function validateBracket(row: { minIncome: number; maxIncome?: number | null }) {
  if (row.maxIncome != null && row.maxIncome <= row.minIncome) throw new z.ZodError([{ code: "custom", path: ["maxIncome"], message: "Ceiling must exceed floor" }]);
}
