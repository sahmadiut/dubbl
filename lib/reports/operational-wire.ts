import { z } from "zod";
import { bankAccountIdField } from "@/lib/api/bank-account-wire";
import { reportDateSchema } from "./statement-wire";
import { forecastAddDays, forecastCurrencySchema } from "./forecast-fx-wire";

export const recurringReportSchema = z.object({
  bankAccountId: bankAccountIdField.optional().describe("Optional live organization-owned bank UUID; inactive historical accounts are included"),
  minOccurrences: z.number().int().min(2).max(10000).default(2).describe("Minimum matching movements per description and bank currency; integer 2-10000, default 2"),
}).strict();
export const calendarReportSchema = z.object({
  startDate: reportDateSchema.optional().describe("Inclusive Gregorian YYYY-MM-DD; defaults to today in UTC"),
  endDate: reportDateSchema.optional().describe("Inclusive Gregorian YYYY-MM-DD; defaults to startDate plus 60 UTC days"),
  currencyCode: forecastCurrencySchema.optional().describe("Optional currency filter; events otherwise retain separate currencyCode tags without aggregation or FX"),
}).strict();
export const duplicateReportSchema = z.object({}).strict();

export function operationalQuery(request: Request, kind: "recurring" | "calendar" | "duplicates") {
  const query = new URL(request.url).searchParams;
  const allowed = kind === "recurring" ? Object.keys(recurringReportSchema.shape) : kind === "calendar" ? Object.keys(calendarReportSchema.shape) : [];
  if ([...query.keys()].some(key => !allowed.includes(key)) || allowed.some(key => query.getAll(key).length > 1))
    throw new z.ZodError([{ code: "custom", path: [], message: "Unsupported or duplicate operational report parameter" }]);
  const input: Record<string, unknown> = Object.fromEntries(query);
  if (query.has("minOccurrences")) {
    const value = query.get("minOccurrences")!;
    if (!/^[1-9]\d{0,4}$/.test(value)) throw new z.ZodError([{ code: "custom", path: ["minOccurrences"], message: "Expected integer 2-10000" }]);
    input.minOccurrences = Number(value);
  }
  return input;
}

export function calendarReportParams(input: unknown) {
  const params = calendarReportSchema.parse(input);
  const startDate = params.startDate ?? new Date().toISOString().slice(0, 10);
  // Explicit end dates avoid unnecessary arithmetic beyond the supported date range.
  let endDate = params.endDate;
  if (!endDate) {
    try { endDate = forecastAddDays(startDate, 60); }
    catch { throw new z.ZodError([{ code: "custom", path: ["endDate"], message: "Default end date exceeds year 9999; supply endDate" }]); }
  }
  if (startDate > endDate) throw new z.ZodError([{ code: "custom", path: ["endDate"], message: "endDate must be on or after startDate" }]);
  return { ...params, startDate, endDate };
}

export function normalizeRecurringDescription(description: string) {
  return description.toLowerCase().trim().replace(/[0-9]/g, "").replace(/[^a-z\s]/g, "").replace(/\s+/g, " ").trim();
}
export function recurringFrequency(interval: number | null) {
  if (interval === null) return "irregular";
  for (const [low, high, name] of [[6, 8, "weekly"], [13, 15, "biweekly"], [28, 31, "monthly"], [88, 93, "quarterly"], [360, 370, "yearly"]] as const)
    if (interval >= low && interval <= high) return name;
  return "irregular";
}
