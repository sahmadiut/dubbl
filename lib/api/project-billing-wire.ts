import { z } from "zod";
import { projectIdSchema, projectAmounts } from "./project-master-wire";
import { rateDateSchema } from "@/lib/currency/rate-policy";
import { currencyCodeSchema } from "@/lib/currency/zod";
import { exactMinorSchema, legacyMinor, WireCompatibilityError } from "@/lib/money/wire";
import { invoiceDecimalRatio, invoiceRound } from "./invoice-write-wire";

const id = projectIdSchema;
const ids = z.array(id).min(1).max(1000).refine(v => new Set(v).size === v.length, "Duplicate IDs").describe("1 to 1000 distinct IDs belonging to this project");
export const markupSchema = z.number().int().min(0).max(2147483647).describe("Nonnegative int32 markup basis points; 1000 = 10%");
export const billingItemSchema = z.object({
  sourceType: z.enum(["bill_line", "expense_item", "journal_line"]).default("bill_line").describe("Scoped posted/approved source cost line kind"),
  sourceLineId: id.describe("Organization-owned source line UUID; project-tagged where the source supports it"),
  description: z.string().min(1).optional().describe("Optional nonempty description override"),
  costAmount: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).refine(v => !Object.is(v, -0)).optional().describe("Optional nonnegative integer cents override; defaults to source cost"),
  costAmountMinor: exactMinorSchema.refine(v => !v.startsWith("-")).optional().describe("Canonical nonnegative integer cents string; must agree with costAmount; safe Number range supported"),
  markupBasisPoints: markupSchema.default(0).describe("Markup basis points; defaults to zero"),
}).strict();
const invoiceFields = {
  projectId: id,
  issueDate: rateDateSchema.optional().describe("Gregorian issue date; defaults to UTC today"),
  dueDate: rateDateSchema.optional().describe("Gregorian due date; defaults to issue date plus 30 UTC days"),
  notes: z.string().nullable().optional().describe("Optional invoice notes; null means none"),
  defaultExpenseMarkupBasisPoints: markupSchema.default(0).describe("Default markup when an item's saved markup is zero"),
  requestKey: id.optional().describe("Optional retry UUID; the same operation and inputs return the original live invoice without writes"),
};
export const billingSchemas = {
  list: z.object({ projectId: id }).strict(),
  register: z.object({ projectId: id, items: z.array(billingItemSchema).min(1).max(1000).describe("Cost lines registered atomically; duplicate source keys reject") }).strict(),
  unregister: z.object({ projectId: id, itemId: id.describe("Unbilled item UUID belonging to this project") }).strict(),
  invoice: z.object({ ...invoiceFields, includeBillableExpenses: z.boolean().default(true).describe("Include all registered unbilled costs; defaults true") }).strict(),
  progress: z.object({ ...invoiceFields,
    contactId: id.optional().describe("Optional live organization-owned customer override"),
    milestoneIds: ids.optional().describe("Selected unbilled milestones; only for milestone billing"),
    timeEntryIds: ids.optional().describe("Selected billable unbilled time entries; only for hourly billing"),
    percentageToInvoice: z.number().min(0).max(100).optional().describe("Percent of original fixed price; exact decimal spelling used, cannot exceed remaining price"),
    includeBillableExpenses: z.boolean().default(false).describe("Include registered unbilled costs; defaults false"),
    billableItemIds: ids.optional().describe("Selected unbilled costs; requires includeBillableExpenses, omission selects all"),
  }).strict(),
  profitability: z.object({
    projectId: id.optional().describe("Optional project UUID; otherwise all live organization projects"),
    startDate: rateDateSchema.optional().describe("Inclusive Gregorian start date; defaults UTC January 1 this year"),
    endDate: rateDateSchema.optional().describe("Inclusive Gregorian end date; defaults UTC today"),
    currency: currencyCodeSchema.optional().describe("Optional saved currency filter; required for mixed-currency project summaries"),
  }).strict(),
};
export type BillingOperation = keyof typeof billingSchemas;
export function billingCost(input: Record<string, unknown>) { return projectAmounts(input, ["costAmount"]); }
export function billingInteger(value: unknown, nonnegative = true): bigint {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || (nonnegative && value < 0)) throw new WireCompatibilityError("Unsupported saved project billing amount or physical integer");
  return BigInt(value);
}
export function billingMarkup(cost: number, markup: number) {
  if (!markupSchema.safeParse(markup).success) throw new WireCompatibilityError("Unsupported saved markup");
  return legacyMinor(invoiceRound(billingInteger(cost) * (10000n + BigInt(markup)), 10000n));
}
export function billingTime(minutes: number, rate: number) { return legacyMinor(invoiceRound(billingInteger(minutes) * billingInteger(rate), 60n)); }
export function billingPercent(amount: number, percent: number) {
  const r = invoiceDecimalRatio(percent); return legacyMinor(invoiceRound(billingInteger(amount) * r.numerator, r.denominator * 100n));
}
export function billingRatio(n: bigint, d: bigint, scale = 10000n) { return d > 0n ? legacyMinor(invoiceRound(n * scale, d)) / 100 : 0; }
export function billingDto<T extends object>(row: T, fields: readonly (keyof T & string)[]) {
  const aliases: Record<string, string> = {};
  for (const f of fields) aliases[`${f}Minor`] = billingInteger(row[f], false).toString();
  return { ...row, ...aliases };
}
