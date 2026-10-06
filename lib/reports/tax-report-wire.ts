import { z } from "zod";
import { exactMinorSchema, legacyMinorSchema, WireCompatibilityError } from "@/lib/money/wire";
import { reportDateSchema, reportMinor } from "./statement-wire";

const dates = {
  startDate: reportDateSchema.optional().describe("Inclusive Gregorian start date; required except tax-summary and 1099"),
  endDate: reportDateSchema.optional().describe("Inclusive Gregorian end date; required except tax-summary and 1099"),
};
const ordered = (value: { startDate?: string; endDate?: string }) => !value.startDate || !value.endDate || value.startDate <= value.endDate;
export const taxReportPeriodSchema = z.object(dates).strict().refine(ordered, "startDate must not follow endDate");
export const taxReturnReportSchema = z.object({ ...dates,
  basis: z.enum(["cash", "accrual"]).optional().describe("Recognition basis override; defaults to organization vatScheme"),
}).strict().refine(ordered, "startDate must not follow endDate");
export const vatReportSchema = taxReturnReportSchema.safeExtend({
  flatRatePercent: z.number().int().min(0).max(10000).refine(value => !Object.is(value, -0), "Negative zero is not canonical").optional().describe("Optional integer basis points 0..10000; zero disables flat rate, positive applies to gross turnover"),
});
export const taxTransactionsSchema = taxReturnReportSchema.safeExtend({
  box: z.enum(["1", "4", "1A", "1B"]).describe("Output control lines: 1/1A; input control lines: 4/1B; live full movement, not frozen filing lines"),
  periodId: z.string().uuid().optional().describe("Owned tax-period UUID; overrides dates only, basis still defaults to current organization scheme"),
});
export const report1099Schema = z.object({
  year: z.number().int().min(2000).max(2100).optional().describe("Calendar year 2000..2100; defaults to prior UTC year"),
  threshold: legacyMinorSchema.nonnegative().refine(value => !Object.is(value, -0), "Negative zero is not canonical").optional().describe("Optional safe numeric integer cents; default 60000; must agree with thresholdMinor"),
  thresholdMinor: exactMinorSchema.refine(value => BigInt(value) >= 0n).optional().describe("Optional canonical nonnegative integer cents string; safe numeric range only; default 60000"),
}).strict().superRefine((value, ctx) => {
  if (value.threshold !== undefined && value.thresholdMinor !== undefined && BigInt(value.threshold) !== BigInt(value.thresholdMinor))
    ctx.addIssue({ code: "custom", path: ["thresholdMinor"], message: "threshold and thresholdMinor disagree" });
});
export type TaxReportKind = "1099" | "tax-summary" | "sales-tax" | "vat-return" | "vat-transactions" | "bas" | "schedule-c";
export const taxReportSchemas = { "1099": report1099Schema, "tax-summary": taxReportPeriodSchema, "sales-tax": taxReportPeriodSchema,
  "vat-return": vatReportSchema, "vat-transactions": taxTransactionsSchema, bas: taxReturnReportSchema, "schedule-c": taxReportPeriodSchema };

export function taxReportQuery(request: Request, kind: TaxReportKind) {
  const params = new URL(request.url).searchParams;
  const schemas = taxReportSchemas[kind];
  const result: Record<string, unknown> = {};
  for (const [key, value] of params) {
    if (!(key in schemas.shape) || params.getAll(key).length !== 1)
      throw new z.ZodError([{ code: "custom", path: [key], message: "Unsupported or duplicate tax report parameter" }]);
    if (["year", "threshold", "flatRatePercent"].includes(key)) {
      if (!/^(?:0|[1-9]\d*)$/.test(value)) throw new z.ZodError([{ code: "custom", path: [key], message: "Expected canonical nonnegative integer" }]);
      result[key] = Number(value);
    } else result[key] = value;
  }
  return schemas.parse(result);
}

/** Project only final reported bigint cents; all intermediate operations remain exact. */
export function taxReportDto(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(taxReportDto);
  if (value && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      if (typeof item === "bigint") { result[key] = reportMinor(item); result[`${key}Minor`] = item.toString(); }
      else result[key] = taxReportDto(item);
    }
    return result;
  }
  return value;
}
export function taxReportThreshold(input: z.infer<typeof report1099Schema>) {
  const threshold = BigInt(input.thresholdMinor ?? input.threshold ?? 60000);
  if (threshold > BigInt(Number.MAX_SAFE_INTEGER)) throw new WireCompatibilityError("Unsupported 1099 threshold");
  return threshold;
}
/** Preserve Math.round tie direction (towards positive infinity) without floating money. */
export function roundTaxRatio(numerator: bigint, denominator: bigint) {
  const doubled = numerator * 2n + denominator;
  const divisor = denominator * 2n;
  const quotient = doubled / divisor;
  return doubled < 0n && doubled % divisor !== 0n ? quotient - 1n : quotient;
}
