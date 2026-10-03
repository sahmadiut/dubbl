import { z } from "zod";
import { currencyCodeSchema } from "@/lib/currency/zod";
import { rateDateSchema } from "@/lib/currency/rate-policy";
import { invoiceWriteLineFields, invoicePrice, invoiceRound, invoiceDecimalRatio, safeInvoiceMinor, invoiceInputError } from "./invoice-write-wire";
import { publicMoneyDto } from "./public-money-wire";
import { contactDto } from "./contact-wire";
import { stringifyWire, WireCompatibilityError } from "@/lib/money/wire";

// Templates have no saved FX columns. Reject supplied FX instead of discarding it.
export const recurringInvoiceLineSchema = z.strictObject({
  description: invoiceWriteLineFields.description, quantity: invoiceWriteLineFields.quantity,
  unitPrice: invoiceWriteLineFields.unitPrice, unitPriceExact: invoiceWriteLineFields.unitPriceExact,
  unitPriceMinor: invoiceWriteLineFields.unitPriceMinor, accountId: invoiceWriteLineFields.accountId,
  taxRateId: invoiceWriteLineFields.taxRateId, discountPercent: invoiceWriteLineFields.discountPercent,
});
export const recurringInvoiceFields = {
  name: z.string().min(1).describe("Recurring invoice template name"),
  contactId: z.string().uuid().describe("Organization-owned customer contact UUID"),
  frequency: z.enum(["weekly", "fortnightly", "monthly", "quarterly", "semi_annual", "annual"]).describe("UTC schedule frequency; existing month-overflow behavior is retained"),
  startDate: rateDateSchema.describe("First occurrence, canonical Gregorian YYYY-MM-DD"),
  endDate: rateDateSchema.nullable().optional().describe("Inclusive last occurrence date; null means unlimited"),
  maxOccurrences: z.number().int().min(1).max(2147483647).nullable().optional().describe("Int32 occurrence cap; null means unlimited"),
  reference: z.string().nullable().optional().describe("Optional reference copied to each generated invoice"),
  notes: z.string().nullable().optional().describe("Optional notes copied to each generated invoice"),
  currencyCode: currencyCodeSchema.default("USD").describe("Saved currency code; prices use this currency's minor units; defaults to USD"),
  autoSend: z.boolean().default(false).describe("Post each invoice atomically and then attempt email delivery after commit"),
  createAsApproved: z.boolean().default(false).describe("Post each invoice and mark sent without email; defaults to draft generation"),
  lines: z.array(recurringInvoiceLineSchema).min(1).max(1000).describe("1 through 1000 lines; decimal-major numeric/exact prices or canonical minor strings; omitted price is zero"),
};
export const recurringInvoiceCreateSchema = z.strictObject(recurringInvoiceFields);
export const recurringInvoiceUpdateSchema = z.strictObject({
  name: recurringInvoiceFields.name.optional(), frequency: recurringInvoiceFields.frequency.optional(),
  status: z.enum(["active", "paused", "completed"]).optional().describe("Replacement status; reactivation catches up from saved nextRunDate"),
  endDate: recurringInvoiceFields.endDate, maxOccurrences: recurringInvoiceFields.maxOccurrences,
  reference: recurringInvoiceFields.reference, notes: recurringInvoiceFields.notes,
  currencyCode: currencyCodeSchema.optional().describe("Replacement currency; stored prices are never rescaled; changes across minor-unit scales are rejected"),
  autoSend: z.boolean().optional().describe("Post and email future occurrences"),
  createAsApproved: z.boolean().optional().describe("Post future occurrences without email"),
});
export async function readRecurringInvoiceJson(request: Request) {
  try { return z.record(z.string(), z.unknown()).parse(JSON.parse(await request.text())); }
  catch { invoiceInputError("Invalid recurring document JSON object"); }
}
export function recurringInvoiceDates(start: string, end?: string | null) {
  rateDateSchema.parse(start);
  if (end != null) { rateDateSchema.parse(end); if (end < start) invoiceInputError("endDate must be on or after startDate"); }
}
export function recurringInvoiceStoredLines(input: unknown, currency: string) {
  return z.array(recurringInvoiceLineSchema).min(1).max(1000).parse(input).map((line, sortOrder) => {
    const qty = invoiceDecimalRatio(line.quantity), quantity = Number(invoiceRound(qty.numerator * 100n, qty.denominator));
    z.number().int().min(-2147483648).max(2147483647).parse(quantity);
    return { description: line.description, quantity, unitPrice: safeInvoiceMinor(invoicePrice(line, currency).minor),
      discountPercent: line.discountPercent, accountId: line.accountId ?? null, taxRateId: line.taxRateId ?? null, sortOrder };
  });
}
type Line = { description: string; quantity: number; unitPrice: number; discountPercent: number; accountId: string | null; taxRateId: string | null };
/** Stored hundredth quantities and minor prices are multiplied as integer ratios. */
export function recurringInvoiceTotals(lines: Line[], rates: Map<string, number>, discount = true) {
  if (!lines.length || lines.length > 1000) invoiceInputError("Recurring invoices require 1 through 1000 lines");
  let subtotal = 0n, taxTotal = 0n;
  const processedLines = lines.map((line, sortOrder) => {
    publicMoneyDto(line, ["unitPrice"]);
    z.number().int().min(-2147483648).max(2147483647).parse(line.quantity);
    z.number().int().min(0).max(10000).parse(line.discountPercent);
    const gross = invoiceRound(BigInt(line.quantity) * BigInt(line.unitPrice), 100n);
    safeInvoiceMinor(gross);
    const amount = gross - (discount ? invoiceRound(gross * BigInt(line.discountPercent), 10000n) : 0n);
    const rate = line.taxRateId ? rates.get(line.taxRateId) : 0;
    z.number().int().min(0).max(2147483647).parse(rate);
    const taxAmount = invoiceRound(amount * BigInt(rate!), 10000n);
    subtotal += amount; taxTotal += taxAmount;
    return { description: line.description, quantity: line.quantity, unitPrice: line.unitPrice, accountId: line.accountId,
      taxRateId: line.taxRateId, discountPercent: line.discountPercent, sortOrder,
      amount: safeInvoiceMinor(amount), taxAmount: safeInvoiceMinor(taxAmount) };
  });
  return { processedLines, subtotal: safeInvoiceMinor(subtotal), taxTotal: safeInvoiceMinor(taxTotal), total: safeInvoiceMinor(subtotal + taxTotal) };
}
export function recurringInvoiceDto<T extends { currencyCode: string; organizationId: string; lines?: Line[]; contact?: { organizationId: string; creditLimit: number | null } | null }>(row: T) {
  currencyCodeSchema.parse(row.currencyCode);
  if (row.contact && row.contact.organizationId !== row.organizationId) throw new WireCompatibilityError("Recurring invoice contact belongs to another organization");
  const result = { ...row, ...(row.lines ? { lines: row.lines.map(line => publicMoneyDto(line, ["unitPrice"])) } : {}),
    ...(row.contact ? { contact: contactDto(row.contact) } : {}) };
  stringifyWire(result); return result;
}
/** Preserve existing UTC month overflow (January 31 can advance into March). */
export function advanceRecurringInvoiceDate(date: string, frequency: string) {
  rateDateSchema.parse(date);
  const d = new Date(`${date}T00:00:00Z`);
  if (frequency === "weekly" || frequency === "fortnightly") d.setUTCDate(d.getUTCDate() + (frequency === "weekly" ? 7 : 14));
  else if (frequency === "annual") d.setUTCFullYear(d.getUTCFullYear() + 1);
  else { const months = { monthly: 1, quarterly: 3, semi_annual: 6 }[frequency]; if (!months) invoiceInputError("Invalid recurring frequency"); d.setUTCMonth(d.getUTCMonth() + months); }
  const next = d.toISOString().split("T")[0]; rateDateSchema.parse(next);
  if (next <= date) invoiceInputError("Recurring schedule must advance"); return next;
}
