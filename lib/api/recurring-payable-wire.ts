import { z } from "zod";
import { recurringInvoiceFields, recurringInvoiceLineSchema, recurringInvoiceDates, recurringInvoiceTotals } from "./recurring-invoice-wire";
import { invoiceDecimalRatio, invoicePrice, invoiceRound, safeInvoiceMinor } from "./invoice-write-wire";
import { publicMoneyDto } from "./public-money-wire";
import { contactDto } from "./contact-wire";
import { stringifyWire, WireCompatibilityError } from "@/lib/money/wire";
import { currencyCodeSchema } from "@/lib/currency/zod";

// Payables historically multiply every major price by 100, independent of currency.
export const recurringPayableLineSchema = recurringInvoiceLineSchema.extend({
  accountId: recurringInvoiceLineSchema.shape.accountId.describe("Optional organization-owned active account UUID"),
  unitPriceMinor: recurringInvoiceLineSchema.shape.unitPriceMinor.describe("Canonical fixed-cent integer price string, safe integers only; never currency-rescaled"),
});
export const recurringPayableCreateSchema = z.strictObject({
  ...recurringInvoiceFields,
  type: z.enum(["bill", "expense"]).describe("Draft payable document kind"),
  contactId: recurringInvoiceFields.contactId.describe("Organization-owned supplier contact UUID; required for both kinds"),
  autoSend: z.boolean().default(false).describe("Retained legacy invoice-only flag; has no effect on payable drafts"),
  createAsApproved: z.boolean().default(false).describe("Retained legacy invoice-only flag; payable generation always creates drafts"),
  lines: z.array(recurringPayableLineSchema).min(1).max(1000).describe("1 through 1000 lines; numeric/exact major prices multiply by 100 for all currencies"),
});
export const recurringPayableUpdateSchema = recurringPayableCreateSchema.omit({ type: true, contactId: true, startDate: true, lines: true }).partial().extend({
  status: z.enum(["active", "paused", "completed"]).optional().describe("Replacement status; active catches up from saved nextRunDate"),
});
export function recurringPayableStoredLines(input: unknown) {
  return z.array(recurringPayableLineSchema).min(1).max(1000).parse(input).map((line, sortOrder) => {
    const qty = invoiceDecimalRatio(line.quantity);
    const quantity = Number(invoiceRound(qty.numerator * 100n, qty.denominator));
    z.number().int().min(-2147483648).max(2147483647).parse(quantity);
    return { description: line.description, quantity, unitPrice: safeInvoiceMinor(invoicePrice(line, "USD").minor),
      discountPercent: line.discountPercent, accountId: line.accountId ?? null, taxRateId: line.taxRateId ?? null, sortOrder };
  });
}
export function recurringPayableTotals(lines: Parameters<typeof recurringInvoiceTotals>[0], rates: Map<string, number>, type: string, preview = false) {
  // Expense generation and gross preview retain the existing no-discount/no-tax policy.
  const gross = preview || type === "expense";
  return recurringInvoiceTotals(lines, gross ? new Map(lines.flatMap(l => l.taxRateId ? [[l.taxRateId, 0] as const] : [])) : rates, !gross);
}
export function recurringPayableDto<T extends { currencyCode: string; organizationId: string; lines?: { unitPrice: number; debitAmount: number; creditAmount: number }[]; contact?: { organizationId: string; creditLimit: number | null } | null }>(row: T) {
  currencyCodeSchema.parse(row.currencyCode);
  if (row.contact && row.contact.organizationId !== row.organizationId) throw new WireCompatibilityError("Recurring payable contact belongs to another organization");
  const result = { ...row, ...(row.lines ? { lines: row.lines.map(l => publicMoneyDto(l, ["unitPrice", "debitAmount", "creditAmount"])) } : {}),
    ...(row.contact ? { contact: contactDto(row.contact) } : {}) };
  stringifyWire(result); return result;
}
export { recurringInvoiceDates as recurringPayableDates };
