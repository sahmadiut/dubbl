import { z } from "zod";
import { currencyCodeSchema } from "@/lib/currency/zod";
import { legacyMinorSchema, exactMinorSchema, stringifyWire, WireCompatibilityError } from "@/lib/money/wire";
import { payrollNumber } from "@/lib/payroll/exact";
import { roundRatio } from "@/lib/money/exact";
import { runAmount } from "./payroll-run-wire";
import { paymentDate } from "./payroll-payment-wire";

export const compensationId = z.string().uuid().describe("Live organization-owned compensation record UUID");
const text = z.string().min(1).max(10000);
const optionalText = z.string().max(10000).nullable().optional();
const cents = legacyMinorSchema.min(0).refine(v => !Object.is(v, -0), "Negative zero is not canonical");
function fields(name: string, nullable = false) {
  const numeric = nullable ? cents.nullable() : cents;
  const exact = exactMinorSchema.refine(v => !v.startsWith("-"), "Nonnegative amount required");
  const units = name === "totalBudget" ? "Review budget in saved review currency cents; optional; null clears"
    : name === "avgNewHireSalary" ? "Average annual new-hire salary in organization base-currency cents; required when newHires > 0"
    : "Annual salary in band/review currency cents; numeric or Minor alias required on create";
  return { [name]: numeric.optional().describe(units + "; nonnegative safe integer, max 9007199254740991"),
    [name + "Minor"]: (nullable ? exact.nullable() : exact).optional().describe(units + "; canonical nonnegative integer string; same safe range; must agree with numeric alias") };
}
const bandFields = { name: text.describe("Band name"), level: optionalText.describe("Optional role level; null clears"),
  ...fields("minSalary"), ...fields("midSalary"), ...fields("maxSalary") };
export const bandCreateSchema = z.object({ ...bandFields, currency: currencyCodeSchema.optional().describe("ISO annual salary currency; defaults USD; no rescaling") }).strict();
export const bandUpdateSchema = z.object({ ...bandFields, name: bandFields.name.optional(),
  isActive: z.boolean().optional().describe("Whether the band is active") }).strict();
export const reviewCreateSchema = z.object({ name: text.describe("Review name"), effectiveDate: paymentDate.describe("Valid Gregorian effective date YYYY-MM-DD, year 1..9999"),
  ...fields("totalBudget", true) }).strict();
export const reviewUpdateSchema = reviewCreateSchema.partial().extend({
  status: z.enum(["draft", "in_progress", "completed", "cancelled"]).optional().describe("Review status; completed/cancelled records are immutable; this does not apply employee salary changes") });
export const adjustmentSchema = z.number().finite().min(-100).max(1000).refine(v => !Object.is(v, -0) && /^-?\d+(?:\.\d{1,2})?$/.test(String(v)), "Percent must have at most two decimal places").describe("Plain percent -100..1000 with at most 2 decimals, not money or basis points");
export const entryCreateSchema = z.object({ employeeId: compensationId.describe("Live active salary employee UUID in the organization, paid in organization base currency"),
  ...fields("currentSalary"), ...fields("proposedSalary"), adjustmentPercent: adjustmentSchema.optional().describe("Optional informational percent -100..1000, at most 2 decimals; stored as binary32, does not compute salary"),
  reason: optionalText.describe("Optional adjustment reason") }).strict();
export const projectionSchema = z.object({ months: z.number().int().min(1).max(60).default(12).describe("Projection horizon 1..60 months, defaults 12") }).strict();
export const whatIfSchema = z.object({ months: projectionSchema.shape.months,
  salaryAdjustmentPercent: adjustmentSchema.optional().describe("Plain adjustment percent -100..1000, at most 2 decimals; defaults 0"),
  newHires: z.number().int().min(0).max(100000).default(0).describe("New hire count 0..100000, defaults 0"),
  terminations: z.number().int().min(0).max(100000).default(0).describe("Termination count 0..active headcount, defaults 0"),
  ...fields("avgNewHireSalary") }).strict();
export const budgetActualSchema = z.object({ year: z.number().int().min(1).max(9999).optional().describe("Gregorian year 1..9999; defaults current UTC year") }).strict();
export const emptyCompensationSchema = z.object({}).strict();

export function compensationAmounts(input: Record<string, unknown>, names: readonly string[], required = false) {
  const result = { ...input };
  for (const name of names) {
    delete result[name + "Minor"];
    const value = input[name], alias = input[name + "Minor"];
    if (value === undefined && alias === undefined && !required) continue;
    if (name === "totalBudget" && (value === null || alias === null)) {
      if (value !== undefined && alias !== undefined && value !== alias) throw new z.ZodError([{ code: "custom", path: [name], message: "Money aliases disagree" }]);
      result[name] = null;
    } else {
      const amount = runAmount(input, name); cents.parse(amount); result[name] = amount;
    }
  }
  return result;
}
export function compensationDto<T extends object>(row: T, names: readonly string[]) {
  const result: Record<string, unknown> = { ...row } as Record<string, unknown>;
  try {
    for (const name of names) {
      const value = result[name];
      if (name === "totalBudget" && value === null) result[name + "Minor"] = null;
      else { legacyMinorSchema.parse(value); result[name + "Minor"] = String(value); }
    }
    stringifyWire(result); return result as T & Record<string, unknown>;
  } catch (e) { if (e instanceof WireCompatibilityError) throw e; throw new WireCompatibilityError("Unsupported saved compensation amount"); }
}
export function validateBand(row: { minSalary: number; midSalary: number; maxSalary: number; currency: string | null }) {
  for (const v of [row.minSalary, row.midSalary, row.maxSalary]) cents.parse(v);
  if (row.minSalary > row.midSalary || row.midSalary > row.maxSalary) throw new z.ZodError([{ code: "custom", path: [], message: "Require 0 <= minSalary <= midSalary <= maxSalary" }]);
  if (!row.currency || currencyCodeSchema.parse(row.currency) !== row.currency) throw new WireCompatibilityError("Unsupported saved band currency");
}
export function percentBasisPoints(percent: number): bigint {
  adjustmentSchema.parse(percent);
  const negative = percent < 0, [whole, fraction = ""] = String(Math.abs(percent)).split(".");
  return BigInt(whole + fraction.padEnd(2, "0")) * (negative ? -1n : 1n);
}
export function ratioPercent(numerator: bigint, denominator: bigint) {
  return denominator === 0n ? 0 : payrollNumber(roundRatio(numerator * 10000n, denominator, "half-away-from-zero")) / 100;
}
export function compensationQuery(url: URL, key: "months" | "year") {
  const v = url.searchParams.get(key);
  if (v === null) return {};
  if (!/^[1-9]\d{0,3}$/.test(v)) throw new z.ZodError([{ code: "custom", path: [key], message: "Use a canonical positive integer" }]);
  return { [key]: Number(v) };
}
