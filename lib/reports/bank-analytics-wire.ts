import { z } from "zod";
import { bankAccountIdField } from "@/lib/api/bank-account-wire";
import { documentAnalyticsSchema, documentAnalyticsDates } from "./document-analytics-wire";
import { forecastAddDays } from "./forecast-fx-wire";

export const bankCashFlowSchema = documentAnalyticsSchema.extend({
  bankAccountId: bankAccountIdField.optional().describe("Optional live organization-owned bank UUID; inactive accounts remain available for historical cash flow"),
  groupBy: z.enum(["day", "week", "month"]).default("month").describe("UTC calendar grouping; weeks begin Monday, default month"),
}).strict();
export const bankStatusSchema = z.object({
  bankAccountId: bankAccountIdField.optional().describe("Optional active organization-owned bank UUID; omit for all active live accounts, separately tagged by currency"),
}).strict();

export function bankAnalyticsQuery(request: Request, cashFlow: boolean) {
  const query = new URL(request.url).searchParams;
  const allowed = cashFlow ? Object.keys(bankCashFlowSchema.shape) : Object.keys(bankStatusSchema.shape);
  if ([...query.keys()].some(key => !allowed.includes(key)) || allowed.some(key => query.getAll(key).length > 1))
    throw new z.ZodError([{ code: "custom", path: [], message: "Unsupported or duplicate bank report parameter" }]);
  return Object.fromEntries(query);
}

export function bankCashFlowParams(input: unknown) {
  const params = bankCashFlowSchema.parse(input);
  return { ...params, ...documentAnalyticsDates({ startDate: params.startDate, endDate: params.endDate, currencyCode: params.currencyCode }) };
}

export function bankPeriod(startDate: string, groupBy: "day" | "week" | "month") {
  const date = new Date(`${startDate}T00:00:00Z`);
  if (groupBy === "day") return { label: startDate, startDate, endDate: startDate };
  if (groupBy === "week") {
    const endDate = forecastAddDays(startDate, 6);
    return { label: `${startDate} - ${endDate}`, startDate, endDate };
  }
  date.setUTCMonth(date.getUTCMonth() + 1, 0);
  return { label: new Date(`${startDate}T00:00:00Z`).toLocaleDateString("en-US", { year: "numeric", month: "short", timeZone: "UTC" }),
    startDate, endDate: date.toISOString().slice(0, 10) };
}
