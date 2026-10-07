import { z } from "zod";
import { reportDateSchema, reportMinor } from "./statement-wire";
import { analyticsRound } from "./document-analytics-wire";

const dimension = z.union([z.uuid(), z.enum(["none", "null", ""])])
  .describe("Owned dimension UUID, or none/null/empty for untagged lines");
export const profitLossSchema = z.object({
  startDate: reportDateSchema.optional().describe("Inclusive start; defaults to January 1 of the current UTC year"),
  endDate: reportDateSchema.optional().describe("Inclusive end; defaults to today in UTC"),
  basis: z.enum(["accrual", "cash"]).optional().describe("Accrual by default; cash uses the existing cash-source/bank-account heuristic"),
  costCenterId: dimension.optional().describe("Owned cost center filter; takes precedence over projectId; none/null/empty matches untagged lines"),
  projectId: dimension.optional().describe("Owned project filter; ignored when costCenterId is set; none/null/empty matches untagged lines"),
  compareFrom: reportDateSchema.optional().describe("Inclusive comparison start; requires compareTo"),
  compareTo: reportDateSchema.optional().describe("Inclusive comparison end; requires compareFrom"),
}).strict();
export const incomeStatementSchema = z.object({
  from: reportDateSchema.optional().describe("Inclusive start; omitted means all prior history"),
  to: reportDateSchema.optional().describe("Inclusive end; omitted means no upper cutoff"),
}).strict();
export const pnlComparisonSchema = z.object({
  compare: z.enum(["monthly", "quarterly", "yearly"]).optional().describe("Calendar period type; monthly by default"),
  periods: z.number().int().min(1).max(12).optional().describe("Period count, 1-12; defaults to 6 monthly, 4 quarterly or 3 yearly"),
  asAt: reportDateSchema.optional().describe("Anchor Gregorian date; defaults to today in UTC; includes its full calendar period"),
}).strict();
export type PeriodReportKind = "profit-and-loss" | "income-statement" | "pnl-comparison";
export function periodInputError(message: string) {
  return new z.ZodError([{ code: "custom", path: [], message }]);
}
export function periodRange(startDate: string, endDate: string) {
  if (startDate > endDate) throw periodInputError("Period end must be on or after start");
  return { startDate, endDate };
}
export function periodReportQuery(request: Request, kind: PeriodReportKind) {
  const query = new URL(request.url).searchParams;
  const schema = kind === "profit-and-loss" ? profitLossSchema : kind === "income-statement" ? incomeStatementSchema : pnlComparisonSchema;
  const allowed = [...Object.keys(schema.shape), ...(kind === "profit-and-loss" ? ["format"] : [])];
  if ([...query.keys()].some(key => !allowed.includes(key)) || allowed.some(key => query.getAll(key).length > 1)) {
    throw periodInputError("Unsupported or duplicate report parameter");
  }
  const input: Record<string, unknown> = Object.fromEntries([...query].filter(([key]) => key !== "format"));
  if (kind === "pnl-comparison" && query.has("periods")) {
    const raw = query.get("periods")!;
    if (!/^(?:[1-9]|1[0-2])$/.test(raw)) throw periodInputError("periods must be an integer from 1 to 12");
    input.periods = Number(raw);
  }
  return { input: schema.parse(input), format: z.enum(["json", "pdf", "xlsx"]).parse((query.get("format") ?? "json").toLowerCase()) };
}

/** Math.round percentage to two places, including negative ties toward positive infinity. */
export function periodChangePercent(current: bigint, previous: bigint) {
  return previous === 0n ? 0 : reportMinor(analyticsRound((current - previous) * 10000n, previous < 0n ? -previous : previous)) / 100;
}

/** UTC calendar arithmetic avoids local-midnight ISO shifts, including years below 100. */
export function comparisonWindows(input: unknown) {
  const params = pnlComparisonSchema.parse(input);
  const compareType = params.compare ?? "monthly";
  const anchor = params.asAt ?? new Date().toISOString().slice(0, 10);
  const year = Number(anchor.slice(0, 4)), month = Number(anchor.slice(5, 7)) - 1;
  const count = params.periods ?? (compareType === "monthly" ? 6 : compareType === "quarterly" ? 4 : 3);
  const date = (y: number, m: number, day: number) => {
    const result = new Date(0); result.setUTCFullYear(y, m, day);
    return reportDateSchema.parse(result.toISOString().slice(0, 10));
  };
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const windows = Array.from({ length: count }, (_, index) => {
    const offset = count - 1 - index;
    const startMonth = compareType === "monthly" ? month - offset : compareType === "quarterly" ? Math.floor(month / 3) * 3 - offset * 3 : 0;
    const startYear = compareType === "yearly" ? year - offset : year;
    const startDate = date(startYear, startMonth, 1);
    const endDate = date(startYear, startMonth + (compareType === "monthly" ? 1 : compareType === "quarterly" ? 3 : 12), 0);
    const y = startDate.slice(0, 4), m = Number(startDate.slice(5, 7)) - 1;
    const label = compareType === "monthly" ? `${names[m]} ${Number(y)}` : compareType === "quarterly" ? `Q${Math.floor(m / 3) + 1} ${Number(y)}` : y;
    return { startDate, endDate, label };
  });
  return { compareType, windows };
}
