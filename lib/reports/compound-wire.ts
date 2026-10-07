import { z } from "zod";
import { reportDateSchema, reportMinor } from "./statement-wire";
import { periodInputError, periodRange } from "./period-statement-wire";
import { analyticsRound } from "./document-analytics-wire";
import { WireCompatibilityError } from "@/lib/money/wire";

export const ratioSchema = z.object({
  startDate: reportDateSchema.optional().describe("Inclusive Gregorian start; defaults to January 1 of the current UTC year"),
  endDate: reportDateSchema.optional().describe("Inclusive Gregorian end and balance cutoff; defaults to today in UTC"),
}).strict();
export const packSchema = ratioSchema.extend({
  basis: z.enum(["accrual", "cash"]).optional().describe("Accrual by default; cash uses the shared cash-source/bank-account heuristic"),
});
export const trackingSchema = packSchema.extend({
  dimension: z.enum(["costCenterId", "projectId", "project"]).optional().describe("Cost center by default; project is a legacy alias for projectId"),
  mode: z.enum(["pnl", "balances"]).optional().describe("pnl returns revenue/expenses and net income; balances returns all account types"),
});
export const trackingExportSchema = trackingSchema.extend({
  format: z.enum(["pdf", "xlsx"]).describe("PDF or XLSX, displaying amounts with organization currency scale"),
});

export function compoundDates(params: z.infer<typeof ratioSchema>) {
  const today = new Date().toISOString().slice(0, 10);
  return periodRange(params.startDate ?? `${today.slice(0, 4)}-01-01`, params.endDate ?? today);
}
export type CompoundKind = "tracking-category" | "pack" | "financial-ratios";
export function compoundQuery(request: Request, kind: CompoundKind) {
  const schema = kind === "pack" ? packSchema : kind === "tracking-category" ? trackingSchema : ratioSchema;
  const query = new URL(request.url).searchParams;
  const allowed = [...Object.keys(schema.shape), ...(kind === "financial-ratios" ? [] : ["format"])];
  if ([...query.keys()].some(key => !allowed.includes(key)) || allowed.some(key => query.getAll(key).length > 1)) {
    throw periodInputError("Unsupported or duplicate compound report parameter");
  }
  const rawFormat = (query.get("format") ?? (kind === "pack" ? "xlsx" : "json")).toLowerCase();
  const format = kind === "pack" ? z.enum(["json", "xlsx"]).parse(rawFormat) : z.enum(["json", "pdf", "xlsx"]).parse(rawFormat);
  return { input: schema.parse(Object.fromEntries([...query].filter(([key]) => key !== "format"))),
    format };
}

type Alias<T> = T extends bigint ? string : T extends bigint[] ? string[] : never;
type Dual<T> = T extends bigint ? number : T extends (infer U)[] ? Dual<U>[] : T extends object ?
  { [K in keyof T]: Dual<T[K]> } & { [K in keyof T as T[K] extends bigint | bigint[] ? `${K & string}Minor` : never]: Alias<T[K]> } : T;
/** Arrays keep their aligned numeric values and gain an aligned Minor array. */
export function compoundDual<T>(input: T): Dual<T> {
  const project = (value: unknown): unknown => {
    if (typeof value === "bigint") return reportMinor(value);
    if (Array.isArray(value)) return value.map(project);
    if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).flatMap(([key, item]) => {
      if (typeof item === "bigint") return [[key, reportMinor(item)], [`${key}Minor`, item.toString()]];
      if (Array.isArray(item) && item.every(v => typeof v === "bigint") &&
        ["amounts", "totals", "subtotals", "grandTotals", "byColumn"].includes(key)) {
        return [[key, item.map(project)], [`${key}Minor`, item.map(String)]];
      }
      return [[key, project(item)]];
    }));
    return value;
  };
  return project(input) as Dual<T>;
}

/** Exact rational rounding, matching Math.round ties toward positive infinity. */
export function compoundRatio(numerator: bigint, denominator: bigint, percent = false, days?: number) {
  if (denominator === 0n) return { value: null, exact: null };
  const scale = days === undefined ? (percent ? 10000n : 100n) : BigInt(days);
  const rounded = analyticsRound(numerator * scale * (denominator < 0n ? -1n : 1n), denominator < 0n ? -denominator : denominator);
  const divisor = days === undefined ? 100 : 1;
  const numeric = reportMinor(rounded) / divisor;
  // A decimal Number must round-trip the last displayed digit too.
  if (divisor === 100 && numeric.toFixed(2) !== decimal(rounded)) {
    throw new WireCompatibilityError("Unsupported financial ratio precision");
  }
  return { value: numeric, exact: divisor === 100 ? decimal(rounded) : rounded.toString() };
}
function decimal(value: bigint) {
  const absolute = value < 0n ? -value : value;
  return `${value < 0n ? "-" : ""}${absolute / 100n}.${(absolute % 100n).toString().padStart(2, "0")}`;
}
