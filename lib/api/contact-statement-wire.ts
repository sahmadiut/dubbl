import { z } from "zod";
import { reportDateSchema } from "@/lib/reports/statement-wire";
import { agingSchema } from "@/lib/reports/aging-wire";

export const contactIdSchema = z.string().uuid().describe("Owned live contact UUID");

export const statementFields = {
  startDate: reportDateSchema.optional().describe("Inclusive Gregorian start; defaults to one UTC year ago, clamped on leap day"),
  endDate: reportDateSchema.optional().describe("Inclusive Gregorian end; defaults to today UTC"),
  currencyCode: agingSchema.shape.currencyCode,
};
export const statementSchema = z.object(statementFields).strict();
export function statementPeriod(input: unknown, now = new Date()) {
  const params = statementSchema.parse(input);
  const previous = new Date(now);
  previous.setUTCFullYear(now.getUTCFullYear() - 1);
  if (previous.getUTCMonth() !== now.getUTCMonth()) previous.setUTCDate(0);
  const startDate = params.startDate ?? previous.toISOString().slice(0, 10);
  const endDate = params.endDate ?? now.toISOString().slice(0, 10);
  if (startDate > endDate) throw new z.ZodError([{ code: "custom", path: ["endDate"], message: "End date precedes start date" }]);
  return { ...params, startDate, endDate };
}
export const activityFields = {
  startDate: reportDateSchema.optional().describe("Optional inclusive Gregorian start date"),
  endDate: reportDateSchema.optional().describe("Optional inclusive Gregorian end date"),
  limit: z.number().int().min(1).max(100).optional().describe("Page size 1-100; default 30"),
  cursor: z.iso.datetime({ offset: true }).optional().describe("Exclusive createdAt timestamp cursor with UTC or offset"),
  type: z.string().refine(value => value.split(",").every(t => ["invoice", "quote", "credit_note", "payment", "bill"].includes(t)), "Unsupported activity type")
    .optional().describe("Comma-separated invoice,quote,credit_note,payment,bill; omitted selects all"),
};
export const activitySchema = z.object(activityFields).strict().refine(p => !p.startDate || !p.endDate || p.startDate <= p.endDate, "End date precedes start date");
export function contactQuery(request: Request, kind: "statement" | "activity", allowOrgId = false) {
  const query = new URL(request.url).searchParams;
  const allowed = [...Object.keys(kind === "statement" ? statementFields : activityFields), ...(allowOrgId ? ["orgId"] : [])];
  if ([...query.keys()].some(key => !allowed.includes(key)) || allowed.some(key => query.getAll(key).length > 1)) {
    throw new z.ZodError([{ code: "custom", path: [], message: "Unsupported or duplicate contact parameter" }]);
  }
  const input: Record<string, unknown> = Object.fromEntries([...query].filter(([key]) => key !== "orgId"));
  if (kind === "activity" && query.has("limit")) input.limit = /^\d+$/.test(query.get("limit")!) ? Number(query.get("limit")) : NaN;
  return kind === "statement" ? statementSchema.parse(input) : activitySchema.parse(input);
}
