import { z } from "zod";
import { documentAnalyticsSchema } from "./document-analytics-wire";

export const expenseAnalyticsSchema = documentAnalyticsSchema.omit({ currencyCode: true }).strict();
export const executiveSummarySchema = expenseAnalyticsSchema.extend({
  basis: z.enum(["accrual", "cash"]).optional().describe("Accrual by default; cash uses the shared payment/bank-entry heuristic"),
}).strict();
export const executiveExportSchema = executiveSummarySchema.extend({
  format: z.enum(["pdf", "xlsx"]).describe("Binary export format; returns base64 data with filename and MIME type"),
}).strict();
export const monthlyTrendsSchema = z.object({
  months: z.number().int().min(1).max(24).optional().describe("Number of UTC calendar months including the current month; integer 1-24, default 6"),
}).strict();
export const contactProfitabilitySchema = documentAnalyticsSchema;
export type KpiAnalyticsKind = "expense-analytics" | "monthly-trends" | "executive-summary" | "profitability";

export function kpiAnalyticsQuery(request: Request, kind: KpiAnalyticsKind) {
  const query = new URL(request.url).searchParams;
  const allowed = kind === "monthly-trends" ? ["months"] : ["startDate", "endDate",
    ...(kind === "executive-summary" ? ["basis", "format"] : []),
    ...(kind === "profitability" ? ["currencyCode", "groupBy"] : [])];
  if ([...query.keys()].some(key => !allowed.includes(key)) || allowed.some(key => query.getAll(key).length > 1)) {
    throw new z.ZodError([{ code: "custom", path: [], message: "Unsupported or duplicate analytics parameter" }]);
  }
  if (query.has("groupBy")) z.literal("contact").parse(query.get("groupBy"));
  const input: Record<string, unknown> = Object.fromEntries([...query].filter(([key]) => key !== "format" && key !== "groupBy"));
  if (query.has("months")) {
    const months = query.get("months")!;
    if (!/^[1-9]\d?$/.test(months)) throw new z.ZodError([{ code: "custom", path: ["months"], message: "Expected integer months 1-24" }]);
    input.months = Number(months);
  }
  const format = z.enum(["json", "pdf", "xlsx"]).parse((query.get("format") ?? "json").toLowerCase());
  const schema = kind === "monthly-trends" ? monthlyTrendsSchema : kind === "executive-summary" ? executiveSummarySchema
    : kind === "profitability" ? contactProfitabilitySchema : expenseAnalyticsSchema;
  schema.parse(input);
  return { input, format };
}

/** UTC date arithmetic also checks that the prior comparison stays in years 0001-9999. */
export function executivePriorPeriod(startDate: string, endDate: string) {
  const start = Date.parse(`${startDate}T00:00:00Z`), end = Date.parse(`${endDate}T00:00:00Z`);
  const length = (end - start) / 86400000 + 1;
  const priorStart = new Date(start - length * 86400000).toISOString().slice(0, 10);
  const priorEnd = new Date(start - 86400000).toISOString().slice(0, 10);
  expenseAnalyticsSchema.parse({ startDate: priorStart, endDate: priorEnd });
  return { startDate: priorStart, endDate: priorEnd };
}

export function utcMonthWindow(months: number, now = new Date()) {
  const first = new Date(now);
  first.setUTCDate(1);
  first.setUTCMonth(first.getUTCMonth() - months + 1);
  const keys: string[] = [];
  for (let i = 0; i < months; i++) {
    const current = new Date(first); current.setUTCMonth(first.getUTCMonth() + i);
    keys.push(current.toISOString().slice(0, 7));
  }
  const last = new Date(now); last.setUTCMonth(last.getUTCMonth() + 1, 0);
  return { startDate: first.toISOString().slice(0, 10), endDate: last.toISOString().slice(0, 10), keys };
}
