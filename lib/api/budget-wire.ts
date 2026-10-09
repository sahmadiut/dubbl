import { z } from "zod";
import { exactMinorSchema, legacyMinorSchema, WireCompatibilityError } from "@/lib/money/wire";
import { generatePeriods, type PeriodType } from "@/lib/budget-periods";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => value >= "0001-01-01"
  && Number.isFinite(Date.parse(`${value}T00:00:00Z`))
  && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value, "Valid Gregorian date required")
  .describe("Canonical Gregorian YYYY-MM-DD date");

export const budgetPeriodSchema = z.object({
  label: z.string().min(1).describe("Period label"),
  startDate: date.describe("Period start date, Gregorian YYYY-MM-DD"),
  endDate: date.describe("Period end date, Gregorian YYYY-MM-DD"),
  amount: legacyMinorSchema.optional().describe("Optional signed safe integer cents; defaults to zero when both aliases are omitted"),
  amountMinor: exactMinorSchema.optional().describe("Optional signed int64 ASCII integer string in the same stored cents; must agree with amount"),
  sortOrder: z.number().int().min(-2147483648).max(2147483647).default(0).describe("Int32 display order, default zero"),
}).strict();
export const budgetLineSchema = z.object({
  accountId: z.string().uuid().describe("Chart account UUID belonging to this organization"),
  total: legacyMinorSchema.optional().describe("Optional signed safe integer line total in cents; otherwise sum of periods or zero"),
  totalMinor: exactMinorSchema.optional().describe("Optional signed int64 ASCII integer line-total string in cents; must agree with total"),
  periods: z.array(budgetPeriodSchema).max(10000).optional().describe("Explicit periods; omit or pass an empty array for automatic distribution"),
}).strict();
export const budgetThresholdSchema = z.number().int().min(0).max(2147483647).nullable()
  .describe("Nonnegative integer threshold percent (100 means the full budget, maximum 2147483647); null disables notifications");
const headerFields = {
  name: z.string().min(1).describe("Budget name"),
  fiscalYearId: z.string().uuid().nullable().optional().describe("Fiscal year UUID belonging to this organization, or null"),
  startDate: date.describe("Budget start date, Gregorian YYYY-MM-DD"),
  endDate: date.describe("Budget end date, Gregorian YYYY-MM-DD"),
  periodType: z.enum(["monthly", "weekly", "daily", "quarterly", "yearly", "custom"]).default("monthly")
    .describe("Automatic period type; custom generates one full-range period"),
  isActive: z.boolean().default(true).describe("Whether the budget is active"),
  varianceThresholdPct: budgetThresholdSchema.optional().describe("Optional integer threshold percent; omitted uses 100, null disables notifications"),
};
export const budgetCreateSchema = z.object({ ...headerFields,
  lines: z.array(budgetLineSchema).min(1).max(500).describe("Budget lines, 1-500; at most 10000 periods across the budget"),
}).strict();
export const budgetUpdateSchema = z.object({
  name: headerFields.name.optional().describe("Optional new budget name"),
  fiscalYearId: headerFields.fiscalYearId,
  startDate: date.optional().describe("Optional new Gregorian start date"),
  endDate: date.optional().describe("Optional new Gregorian end date"),
  periodType: headerFields.periodType.removeDefault().optional().describe("Optional new automatic period type"),
  isActive: z.boolean().optional().describe("Optional active status"),
  varianceThresholdPct: budgetThresholdSchema.optional().describe("Optional integer threshold percent; omitted preserves it, null disables notifications"),
  lines: z.array(budgetLineSchema).max(500).optional().describe("Replacement lines; omitted leaves lines unchanged, empty removes them"),
}).strict();

export function safeBudgetMinor(value: bigint): number {
  const limit = BigInt(Number.MAX_SAFE_INTEGER);
  if (value < -limit || value > limit) throw new WireCompatibilityError();
  return Number(value);
}

function amountInput(numeric: number | undefined, exact: string | undefined): number | undefined {
  if (numeric !== undefined && exact !== undefined && BigInt(numeric) !== BigInt(exact)) {
    throw new z.ZodError([{ code: "custom", message: "Numeric and exact budget amount aliases disagree", path: [] }]);
  }
  return exact !== undefined ? safeBudgetMinor(BigInt(exact)) : numeric;
}

/** Floor quotient plus first-period remainder matches the existing signed allocation. */
export function distributeBudgetAmount(total: number, count: number): number[] {
  if (!Number.isSafeInteger(total)) throw new WireCompatibilityError();
  if (!Number.isInteger(count) || count < 1 || count > 10000) throw new WireCompatibilityError("Budget period count must be 1 through 10000");
  const amount = BigInt(total), n = BigInt(count);
  const quotient = amount / n - (amount % n < 0n ? 1n : 0n);
  const remainder = amount - quotient * n;
  return Array.from({ length: count }, (_, index) => safeBudgetMinor(quotient + (BigInt(index) < remainder ? 1n : 0n)));
}

export function validateBudgetDates(start: string, end: string) {
  date.parse(start); date.parse(end);
  if (start > end) throw new z.ZodError([{ code: "custom", message: "Budget start date must not be after end date", path: [] }]);
}

export function prepareBudgetLines(input: unknown, periodType: PeriodType, start: string, end: string) {
  validateBudgetDates(start, end);
  if (!["monthly", "weekly", "daily", "quarterly", "yearly", "custom"].includes(periodType)) {
    throw new WireCompatibilityError("Unsupported stored budget period type");
  }
  const lines = z.array(budgetLineSchema).max(500).parse(input);
  let periodCount = 0;
  return lines.map(line => {
    const suppliedTotal = amountInput(line.total, line.totalMinor);
    let periods;
    if (line.periods?.length) {
      periods = line.periods.map(period => {
        validateBudgetDates(period.startDate, period.endDate);
        const { amountMinor, ...fields } = period;
        return { ...fields, amount: amountInput(period.amount, amountMinor) ?? 0 };
      });
    } else {
      // Bound generated work before allocating dates/arrays, including extreme valid years.
      const years = Number(end.slice(0, 4)) - Number(start.slice(0, 4));
      const months = years * 12 + Number(end.slice(5, 7)) - Number(start.slice(5, 7));
      const days = (Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86400000 + 1;
      const estimate = periodType === "daily" ? days : periodType === "weekly" ? Math.ceil(days / 7)
        : periodType === "monthly" ? months + 1 : periodType === "quarterly"
          ? years * 4 + Math.floor((Number(end.slice(5, 7)) - 1) / 3) - Math.floor((Number(start.slice(5, 7)) - 1) / 3) + 1
          : periodType === "yearly" ? years + 1 : 1;
      if (estimate + periodCount > 10000) throw new WireCompatibilityError("Budget supports at most 10000 periods");
      const generated = generatePeriods(periodType, start, end);
      const amounts = distributeBudgetAmount(suppliedTotal ?? 0, generated.length);
      periods = generated.map((period, index) => ({ ...period, amount: amounts[index] }));
    }
    periodCount += periods.length;
    if (periodCount > 10000) throw new WireCompatibilityError("Budget supports at most 10000 periods");
    const sum = safeBudgetMinor(periods.reduce((total, period) => total + BigInt(period.amount), 0n));
    return { accountId: line.accountId, total: suppliedTotal ?? sum, periods };
  });
}

export function budgetDto<T extends { lines: { total: number; periods: { amount: number }[] }[] }>(value: T) {
  const minorString = (amount: number) => {
    if (!Number.isSafeInteger(amount)) throw new WireCompatibilityError();
    return BigInt(amount).toString();
  };
  return { ...value, lines: value.lines.map(line => ({ ...line,
    totalMinor: minorString(line.total),
    periods: line.periods.map(period => ({ ...period, amountMinor: minorString(period.amount) })),
  })) };
}
