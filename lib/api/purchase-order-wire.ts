import { z } from "zod";
import { currencyCodeSchema } from "@/lib/currency/zod";
import { rateDateSchema } from "@/lib/currency/rate-policy";
import { stringifyWire, WireCompatibilityError } from "@/lib/money/wire";
import { invoiceWriteLineSchema, invoiceWriteTotals, invoiceDecimalRatio, invoiceRound, invoiceInputError,
  safeInvoiceMinor } from "./invoice-write-wire";
import { publicMoneyDto, publicLineDto } from "./public-money-wire";
import { contactDto } from "./contact-wire";

export const purchaseOrderLineSchema = invoiceWriteLineSchema.omit({ costCenterId: true, projectId: true, priceListId: true }).extend({
  description: z.string().min(1).describe("Nonempty purchase order line description"),
  unitPrice: invoiceWriteLineSchema.shape.unitPrice.describe("Optional decimal major-unit price (USD 12.50); omitted prices default to zero"),
  accountId: z.string().uuid().nullable().optional().describe("Optional organization-owned expense/asset account UUID"),
});
export const purchaseOrderCreateFields = {
  contactId: z.string().uuid().describe("Organization-owned supplier contact UUID"),
  issueDate: rateDateSchema.describe("Gregorian issue date YYYY-MM-DD; must be unlocked"),
  deliveryDate: rateDateSchema.nullable().optional().describe("Optional Gregorian delivery date YYYY-MM-DD; null clears"),
  reference: z.string().nullable().optional().describe("Optional supplier reference; null clears"),
  notes: z.string().nullable().optional().describe("Optional purchase order notes; null clears"),
  currencyCode: currencyCodeSchema.default("USD").describe("Currency code; omission defaults USD in REST and MCP, with no FX conversion"),
  lines: z.array(purchaseOrderLineSchema).min(1).max(1000).describe("1 through 1000 lines; quantities in physical units, discounts in basis points"),
};
export const purchaseOrderCreateSchema = z.object(purchaseOrderCreateFields);
// Retain the existing PATCH contract: extended prices, no line discounts or tax calculation.
export const purchaseOrderUpdateFields = {
  contactId: purchaseOrderCreateFields.contactId.optional().describe("Optional replacement organization-owned supplier UUID"),
  issueDate: rateDateSchema.optional().describe("Optional Gregorian issue date; old and new dates must be unlocked"),
  deliveryDate: purchaseOrderCreateFields.deliveryDate, reference: purchaseOrderCreateFields.reference, notes: purchaseOrderCreateFields.notes,
  lines: z.array(purchaseOrderLineSchema.omit({ discountPercent: true })).min(1).max(1000).optional()
    .describe("Optional complete replacement lines; legacy PATCH calculates no discounts/tax, retaining taxRateId for reference"),
};
export const purchaseOrderUpdateSchema = z.object(purchaseOrderUpdateFields);
export const purchaseOrderListFields = {
  status: z.enum(["draft", "sent", "partial", "received", "closed", "void"]).optional().describe("Optional purchase order status filter"),
  contactId: z.string().uuid().optional().describe("Optional organization-owned supplier UUID filter"),
  page: z.number().int().min(1).max(21474836).default(1).describe("Page number starting at 1, bounded for SQL offsets"),
  limit: z.number().int().min(1).max(100).default(50).describe("Page size 1 through 100; defaults 50"),
};
export const purchaseOrderListSchema = z.object(purchaseOrderListFields);
export const purchaseOrderConvertFields = {
  lines: z.array(z.object({
    purchaseOrderLineId: z.string().uuid().describe("UUID of a line on this purchase order; duplicates reject"),
    quantity: z.number().positive().max(21474836.47).describe("Physical quantity to bill; rounded to positive int32 hundredths; cannot exceed unbilled quantity"),
  }).strict()).min(1).max(1000).optional().describe("Optional partial quantities; omission bills all remaining quantities, including after prior partial bills"),
};
export const purchaseOrderConvertSchema = z.object(purchaseOrderConvertFields).strict();
const templateFields = {
  organizationName: z.string().describe("Organization display name"), contactName: z.string().describe("Supplier display name"),
  documentType: z.string().describe("Document type label"), documentNumber: z.string().describe("Purchase order number label"),
  personalMessage: z.string().optional().describe("Optional personal message"),
  amountFormatted: z.string().optional().describe("Optional formatted amount label; not a stored monetary value"),
  dueDateFormatted: z.string().optional().describe("Optional formatted delivery date label"),
  issueDateFormatted: z.string().optional().describe("Optional formatted issue date label"),
  viewUrl: z.string().optional().describe("Optional document link"), buttonLabel: z.string().optional().describe("Optional link button label"),
};
export const purchaseOrderSendFields = {
  sendEmail: z.boolean().default(false).describe("True sends the supplied email after marking sent; false only marks sent"),
  recipientEmail: z.string().email().optional().describe("Required valid supplier email when sendEmail=true"),
  subject: z.string().min(1).optional().describe("Required nonempty email subject when sendEmail=true"),
  templateProps: z.object(templateFields).optional().describe("Required email template display labels when sendEmail=true"),
  attachPdf: z.boolean().default(false).describe("Legacy flag accepted; this operation does not attach a purchase order PDF"),
};
export const purchaseOrderSendSchema = z.object(purchaseOrderSendFields).superRefine((value, ctx) => {
  if (value.sendEmail && (!value.recipientEmail || !value.subject || !value.templateProps))
    ctx.addIssue({ code: "custom", path: ["sendEmail"], message: "Sending email requires recipientEmail, subject and templateProps" });
});
export type PurchaseOrderInputLine = z.infer<typeof purchaseOrderLineSchema>;
export function purchaseOrderTotals(lines: PurchaseOrderInputLine[], currency: string, rates: Map<string, number>, update = false) {
  const totals = invoiceWriteTotals(lines.map(line => ({ ...line, ...(update ? { discountPercent: 0, taxRateId: null } : {}) })), currency, false, rates);
  return { ...totals, processedLines: totals.processedLines.map((line, i) => ({ description: line.description, quantity: line.quantity,
    unitPrice: line.unitPrice, amount: line.amount, taxAmount: line.taxAmount, accountId: line.accountId,
    taxRateId: lines[i].taxRateId ?? null, inventoryItemId: line.inventoryItemId, warehouseId: line.warehouseId, sortOrder: line.sortOrder })) };
}
type Header = { subtotal: number; taxTotal: number; total: number };
export function purchaseOrderDto<T extends Header>(row: T) {
  return publicMoneyDto(row, ["subtotal", "taxTotal", "total"]);
}
type SavedLine = { id: string; description: string; quantity: number; quantityReceived: number; quantityBilled: number;
  unitPrice: number; amount: number; taxAmount: number; accountId: string | null; taxRateId: string | null;
  inventoryItemId: string | null; warehouseId: string | null; sortOrder: number };
export function purchaseOrderReadDto<T extends Header & { contact: { organizationId: string; creditLimit: number | null } | null;
  lines?: (SavedLine & { account?: { organizationId: string } | null; taxRate?: { organizationId: string } | null })[] }>(row: T, org: string) {
  if ((row.contact && row.contact.organizationId !== org) || row.lines?.some(line =>
    (line.account && line.account.organizationId !== org) || (line.taxRate && line.taxRate.organizationId !== org)))
    throw new WireCompatibilityError("Purchase order contains a reference outside this organization");
  const dto = { ...purchaseOrderDto(row), contact: row.contact ? contactDto(row.contact) : null,
    ...(row.lines ? { lines: row.lines.map(publicLineDto) } : {}) };
  stringifyWire(dto); return dto;
}
export function validatePurchaseOrder(header: Header, lines: SavedLine[]) {
  purchaseOrderDto(header);
  for (const line of lines) {
    publicLineDto(line);
    for (const key of ["quantity", "quantityReceived", "quantityBilled"] as const) {
      if (!Number.isInteger(line[key]) || line[key] < -2147483648 || line[key] > 2147483647)
        invoiceInputError("Saved purchase order quantities must be signed int32 hundredths");
    }
    if (line.quantityReceived < 0 || line.quantityBilled < 0 || line.quantityBilled > Math.max(0, line.quantity))
      invoiceInputError("Invalid saved purchase order procurement tallies");
  }
  const subtotal = safeInvoiceMinor(lines.reduce((sum, line) => sum + BigInt(line.amount), 0n));
  const tax = safeInvoiceMinor(lines.reduce((sum, line) => sum + BigInt(line.taxAmount), 0n));
  if (subtotal !== header.subtotal || tax !== header.taxTotal || safeInvoiceMinor(BigInt(subtotal) + BigInt(tax)) !== header.total)
    invoiceInputError("Purchase order header and line balances must agree");
}
export function purchaseOrderBillItems<T extends SavedLine>(lines: T[], input: z.infer<typeof purchaseOrderConvertSchema>,
  previous?: Map<string, { quantity: number; amount: bigint; taxAmount: bigint }>) {
  if (lines.some(line => line.quantity <= 0)) invoiceInputError("Bill conversion requires positive ordered quantities");
  const ids = new Set<string>();
  const selections = input.lines ?? lines.filter(line => line.quantityBilled < line.quantity)
    .map(line => ({ purchaseOrderLineId: line.id, quantity: undefined }));
  const items = selections.map(selection => {
    if (ids.has(selection.purchaseOrderLineId)) invoiceInputError("Duplicate purchase order line selection");
    ids.add(selection.purchaseOrderLineId);
    const line = lines.find(line => line.id === selection.purchaseOrderLineId);
    if (!line) invoiceInputError("Line does not belong to this purchase order");
    const ratio = selection.quantity === undefined ? undefined : invoiceDecimalRatio(selection.quantity);
    const quantity = ratio ? Number(invoiceRound(ratio.numerator * 100n, ratio.denominator)) : line.quantity - line.quantityBilled;
    if (quantity <= 0 || quantity > line.quantity - line.quantityBilled) invoiceInputError("Billing quantity must be positive and cannot exceed the unbilled quantity");
    // Cumulative allocation preserves saved discounts, subminor prices and the final rounding residual.
    const prior = previous?.get(line.id);
    if (previous && (prior?.quantity ?? 0) !== line.quantityBilled)
      throw new WireCompatibilityError("Billed purchase order history lacks qualified conversion allocations");
    const portion = (value: number, allocated?: bigint) => safeInvoiceMinor(invoiceRound(BigInt(value) * BigInt(line.quantityBilled + quantity), BigInt(line.quantity)) -
      (allocated ?? invoiceRound(BigInt(value) * BigInt(line.quantityBilled), BigInt(line.quantity))));
    return { line, quantity, amount: portion(line.amount, prior?.amount), taxAmount: portion(line.taxAmount, prior?.taxAmount) };
  });
  if (!items.length) invoiceInputError("Purchase order is already fully billed");
  return items;
}
