import { z } from "zod";
import { currencyMetadata } from "@/lib/money/exact";
import { WireCompatibilityError } from "@/lib/money/wire";
import { reportDateSchema, reportMinor } from "./statement-wire";

export const documentAnalyticsSchema = z.object({
  startDate: reportDateSchema.optional().describe("Inclusive Gregorian start YYYY-MM-DD; defaults to January 1 of the current UTC year"),
  endDate: reportDateSchema.optional().describe("Inclusive Gregorian end YYYY-MM-DD; defaults to today in UTC"),
  currencyCode: z.string().refine(value => {
    try { return currencyMetadata(value).code === value; } catch { return false; }
  }, "Expected a supported uppercase ISO currency").optional()
    .describe("Optional document currency filter; mixed currencies require this filter, with no FX conversion or unit rescaling"),
}).strict();

export function documentAnalyticsDates(input: unknown) {
  const params = documentAnalyticsSchema.parse(input);
  const today = new Date().toISOString().slice(0, 10);
  const startDate = params.startDate ?? `${today.slice(0, 4)}-01-01`;
  const endDate = params.endDate ?? today;
  if (startDate > endDate) throw new z.ZodError([{ code: "custom", path: ["endDate"], message: "endDate must be on or after startDate" }]);
  return { ...params, startDate, endDate };
}

export function documentAnalyticsQuery(request: Request, sales: boolean) {
  const query = new URL(request.url).searchParams;
  const allowed = ["startDate", "endDate", "currencyCode", ...(sales ? ["format"] : [])];
  if ([...query.keys()].some(key => !allowed.includes(key)) || allowed.some(key => query.getAll(key).length > 1)) {
    throw new z.ZodError([{ code: "custom", path: [], message: "Unsupported or duplicate analytics parameter" }]);
  }
  return { input: Object.fromEntries([...query].filter(([key]) => key !== "format")),
    format: z.enum(["json", "pdf", "xlsx"]).parse((query.get("format") ?? "json").toLowerCase()) };
}

export function analyticsCurrency(value: string) {
  try { if (currencyMetadata(value).code === value) return value; } catch { /* classify below */ }
  throw new WireCompatibilityError("Unsupported saved analytics currency");
}

/** SQL text projections preserve stored integers before the transitional Number ORM. */
export function analyticsStoredMinor(value: string) {
  if (!/^-?(0|[1-9]\d*)$/.test(value) || value.length > 20) throw new WireCompatibilityError("Unsupported stored analytics amount");
  const result = BigInt(value);
  reportMinor(result);
  return result;
}

export function analyticsMoney<T extends string>(key: T, value: bigint) {
  return { [key]: reportMinor(value), [`${key}Minor`]: value.toString() } as
    Record<T, number> & Record<`${T}Minor`, string>;
}

/** Equivalent to Math.round(n/d), including negative ties toward positive infinity. */
export function analyticsRound(numerator: bigint, denominator: bigint) {
  if (denominator <= 0n) throw new WireCompatibilityError("Unsupported analytics divisor");
  const doubled = 2n * numerator + denominator;
  const divisor = 2n * denominator;
  const quotient = doubled / divisor;
  return doubled < 0n && doubled % divisor !== 0n ? quotient - 1n : quotient;
}

export function analyticsPercentage(part: bigint, total: bigint) {
  return total > 0n ? reportMinor(analyticsRound(part * 10000n, total)) / 100 : 0;
}
