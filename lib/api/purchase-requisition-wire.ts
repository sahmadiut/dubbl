import { z } from "zod";
import { rateDateSchema } from "@/lib/currency/rate-policy";
import { currencyCodeSchema } from "@/lib/currency/zod";
import { invoiceWriteLineSchema, invoiceWriteTotals, invoiceInputError, safeInvoiceMinor } from "./invoice-write-wire";
import { publicMoneyDto, publicLineDto } from "./public-money-wire";

export const requisitionLineSchema = invoiceWriteLineSchema.pick({ description: true, quantity: true, unitPrice: true,
  unitPriceExact: true, unitPriceMinor: true, accountId: true, taxRateId: true }).extend({
  description: z.string().min(1).describe("Nonempty requisition line description"),
  unitPrice: invoiceWriteLineSchema.shape.unitPrice.describe("Optional decimal major-unit price (USD 12.50); omission defaults zero"),
  accountId: z.string().uuid().nullable().optional().describe("Optional organization-owned expense/asset account UUID"),
});
export const requisitionCreateFields = {
  contactId: z.string().uuid().nullable().optional().describe("Optional organization-owned supplier UUID; required for PO conversion"),
  requestDate: rateDateSchema.describe("Gregorian request date YYYY-MM-DD; must be unlocked"),
  requiredDate: rateDateSchema.nullable().optional().describe("Optional Gregorian required date YYYY-MM-DD; null clears"),
  reference: z.string().nullable().optional().describe("Optional reference; null clears"),
  notes: z.string().nullable().optional().describe("Optional requisition notes; null clears"),
  currencyCode: currencyCodeSchema.default("USD").describe("Currency code, defaults USD; no currency conversion"),
  lines: z.array(requisitionLineSchema).min(1).max(1000).describe("1 through 1000 lines; quantities in physical units; no tax calculation"),
};
export const requisitionCreateSchema = z.object(requisitionCreateFields);
export const requisitionUpdateFields = {
  contactId: requisitionCreateFields.contactId, requiredDate: requisitionCreateFields.requiredDate,
  reference: requisitionCreateFields.reference, notes: requisitionCreateFields.notes,
};
// The existing UI submits through PUT {status:'submitted'}; arbitrary status changes are forbidden.
export const requisitionUpdateSchema = z.object({ ...requisitionUpdateFields,
  status: z.literal("submitted").optional().describe("Optional draft submission for approval; no other status transition is accepted"),
});
export const requisitionListFields = {
  status: z.enum(["draft", "submitted", "approved", "rejected", "converted"]).optional().describe("Optional requisition status filter"),
  page: z.number().int().min(1).max(21474836).default(1).describe("Page starting at 1, bounded for SQL offsets"),
  limit: z.number().int().min(1).max(100).default(50).describe("Page size 1 through 100; defaults 50"),
};
export const requisitionListSchema = z.object(requisitionListFields);
export const requisitionRejectFields = { reason: z.string().optional().describe("Optional rejection reason") };
export const requisitionRejectSchema = z.object(requisitionRejectFields);
export function requisitionTotals(lines: z.infer<typeof requisitionLineSchema>[], currency: string) {
  const result = invoiceWriteTotals(lines.map(line => ({ ...line, discountPercent: 0, taxRateId: null })), currency, false, new Map());
  return { ...result, processedLines: result.processedLines.map((line, i) => ({ description: line.description,
    quantity: line.quantity, unitPrice: line.unitPrice, amount: line.amount, taxAmount: 0,
    accountId: line.accountId, taxRateId: lines[i].taxRateId ?? null, sortOrder: line.sortOrder })) };
}
type Header = { subtotal: number; taxTotal: number; total: number };
type Line = { unitPrice: number; amount: number; taxAmount: number; quantity: number };
export function requisitionDto<T extends Header>(row: T) { return publicMoneyDto(row, ["subtotal", "taxTotal", "total"]); }
export function validateRequisition(header: Header, lines: Line[]) {
  requisitionDto(header);
  if (!lines.length) invoiceInputError("Requisition must have at least one saved line");
  for (const line of lines) {
    publicLineDto(line);
    if (!Number.isInteger(line.quantity) || line.quantity < -2147483648 || line.quantity > 2147483647)
      invoiceInputError("Saved requisition quantity must be signed int32 hundredths");
    if (line.taxAmount !== 0) invoiceInputError("Requisitions do not calculate tax");
  }
  const subtotal = safeInvoiceMinor(lines.reduce((sum, line) => sum + BigInt(line.amount), 0n));
  if (header.taxTotal !== 0 || subtotal !== header.subtotal || subtotal !== header.total)
    invoiceInputError("Requisition header and line balances must agree without tax");
}
