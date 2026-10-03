import { z } from "zod";
import { currencyCodeSchema } from "@/lib/currency/zod";
import { rateDateSchema } from "@/lib/currency/rate-policy";
import { invoiceWriteLineSchema, invoiceWriteTotals, safeInvoiceMinor } from "./invoice-write-wire";
import { publicMoneyDto } from "./public-money-wire";

// Reuse the established exact decimal ratios and signed rounding policy.
export const billWriteLineSchema = invoiceWriteLineSchema.omit({ costCenterId: true, priceListId: true }).extend({
  description: z.string().min(1).describe("Nonempty bill line description"),
  unitPrice: invoiceWriteLineSchema.shape.unitPrice.describe("Optional legacy decimal major-unit price, e.g. USD 12.50; omitted prices default to zero without price lookup"),
  accountId: z.string().uuid().nullable().optional().describe("Optional organization-owned expense account UUID; null clears"),
  goodsReceiptLineId: z.string().uuid().nullable().optional().describe("Optional organization-owned goods receipt line UUID for later three-way matching"),
});
export const billCreateFields = {
  contactId: z.string().uuid().describe("Organization-owned supplier contact UUID"),
  issueDate: rateDateSchema.describe("Gregorian issue date, YYYY-MM-DD; must be unlocked"),
  dueDate: rateDateSchema.describe("Gregorian due date, YYYY-MM-DD"),
  billNumber: z.string().nullable().optional().describe("Optional supplier invoice number; trimmed blank/null auto-numbers the bill"),
  reference: z.string().nullable().optional().describe("Optional supplier reference; null clears"),
  notes: z.string().nullable().optional().describe("Optional bill notes; null clears"),
  currencyCode: currencyCodeSchema.optional().describe("Explicit currency; REST defaults supplier/org/USD, MCP omission defaults USD"),
  purchaseOrderIds: z.array(z.string().uuid().describe("Organization-owned purchase order UUID")).max(1000).optional().describe("Optional source purchase orders; duplicate UUIDs link once"),
  confirmDuplicate: z.boolean().optional().describe("Acknowledge duplicate warning; cannot override block or hold policy"),
  submitForApproval: z.boolean().default(false).describe("Create pending_approval instead of draft; approval posting remains a separate operation"),
  lines: z.array(billWriteLineSchema).min(1).max(1000).describe("1 through 1000 bill lines; omitted prices default to zero"),
};
export const billCreateSchema = z.object(billCreateFields);
export const billUpdateFields = {
  contactId: billCreateFields.contactId.optional().describe("Optional replacement organization-owned supplier UUID"),
  issueDate: rateDateSchema.optional().describe("Optional replacement Gregorian issue date; both old and new dates must be unlocked"),
  dueDate: rateDateSchema.optional().describe("Optional replacement Gregorian due date"),
  reference: billCreateFields.reference, notes: billCreateFields.notes,
  lines: z.array(billWriteLineSchema).min(1).max(1000).optional().describe("Optional complete replacement line set; omission retains all lines"),
};
export const billUpdateSchema = z.object(billUpdateFields);
export type BillWriteLine = z.infer<typeof billWriteLineSchema>;

export function billWriteTotals(lines: BillWriteLine[], currency: string, rates: Map<string, number>, kinds: Map<string, string>) {
  const totals = invoiceWriteTotals(lines, currency, false, rates);
  const processedLines = totals.processedLines.map((line, index) => ({
    description: line.description, quantity: line.quantity, unitPrice: line.unitPrice, discountPercent: line.discountPercent,
    amount: line.amount, taxAmount: line.taxAmount, accountId: line.accountId, taxRateId: line.taxRateId,
    inventoryItemId: line.inventoryItemId, warehouseId: line.warehouseId, projectId: line.projectId,
    sortOrder: line.sortOrder, goodsReceiptLineId: lines[index].goodsReceiptLineId ?? null,
  }));
  let reverseChargeVat = 0n;
  for (const line of processedLines) {
    if (line.taxRateId && kinds.get(line.taxRateId) === "reverse_charge") reverseChargeVat += BigInt(line.taxAmount);
  }
  safeInvoiceMinor(reverseChargeVat);
  return { ...totals, processedLines, amountDue: safeInvoiceMinor(BigInt(totals.total) - reverseChargeVat) };
}
export function billWriteDto<T extends { subtotal: number; taxTotal: number; total: number; amountPaid: number; amountDue: number }>(row: T) {
  return publicMoneyDto(row, ["subtotal", "taxTotal", "total", "amountPaid", "amountDue"]);
}
