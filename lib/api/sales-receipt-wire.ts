import { z } from "zod";
import { currencyCodeSchema } from "@/lib/currency/zod";
import { rateDateSchema } from "@/lib/currency/rate-policy";
import { stringifyWire } from "@/lib/money/wire";
import { invoiceWriteLineSchema, invoiceWriteTotals, invoiceInputError, safeInvoiceMinor } from "./invoice-write-wire";
import { publicLineDto, publicMoneyDto } from "./public-money-wire";

export const salesReceiptLineSchema = invoiceWriteLineSchema.omit({ priceListId: true }).extend({
  description: z.string().min(1).describe("Nonempty sales receipt line description"),
}).strict();
export const salesReceiptLineFields = salesReceiptLineSchema.shape;
export const salesReceiptCashFields = {
  bankAccountId: z.string().uuid().nullable().optional().describe("Organization-owned bank UUID; takes precedence over depositAccountId; null clears"),
  depositAccountId: z.string().uuid().nullable().optional().describe("Organization-owned deposit chart account UUID; used when no bank selected; null clears"),
};
export const salesReceiptCreateFields = {
  contactId: z.string().uuid().describe("Organization-owned customer contact UUID"),
  date: rateDateSchema.describe("Gregorian sale date, YYYY-MM-DD"),
  reference: z.string().nullable().optional().describe("Optional external reference; null clears"),
  notes: z.string().nullable().optional().describe("Optional notes; null clears"),
  currencyCode: currencyCodeSchema.optional().describe("Receipt currency; defaults to contact, organization, then USD; no rescaling"),
  ...salesReceiptCashFields,
  lines: z.array(salesReceiptLineSchema).min(1).max(1000).describe("1 through 1000 tax-exclusive lines; numeric unitPrice and unitPriceExact are major units, unitPriceMinor is integer minor units"),
};
export const salesReceiptCreateSchema = z.object(salesReceiptCreateFields).strict();
export const salesReceiptUpdateFields = {
  contactId: salesReceiptCreateFields.contactId.optional().describe("Optional replacement organization-owned customer UUID"),
  date: salesReceiptCreateFields.date.optional().describe("Replacement Gregorian sale date; old and new dates must be unlocked"),
  reference: salesReceiptCreateFields.reference, notes: salesReceiptCreateFields.notes,
  currencyCode: currencyCodeSchema.optional().describe("Replacement currency label; retained minor amounts never rescale; replace lines to reprice"),
  ...salesReceiptCashFields,
  lines: salesReceiptCreateFields.lines.optional().describe("Optional complete replacement lines, with exact price aliases; absent prices default to zero"),
};
export const salesReceiptUpdateSchema = z.object(salesReceiptUpdateFields).strict();
export const salesReceiptPostSchema = z.object(salesReceiptCashFields).strict();
export const salesReceiptListFields = {
  status: z.enum(["draft", "paid", "void"]).optional().describe("Optional receipt status filter"),
  contactId: z.string().uuid().optional().describe("Optional customer contact UUID filter"),
  startDate: rateDateSchema.optional().describe("Inclusive Gregorian start date, YYYY-MM-DD"),
  endDate: rateDateSchema.optional().describe("Inclusive Gregorian end date, YYYY-MM-DD"),
  page: z.number().int().min(1).max(21474836).default(1).describe("Page number starting at 1"),
  limit: z.number().int().min(1).max(100).default(50).describe("Page size, 1 through 100; defaults to 50"),
  sortBy: z.enum(["date", "total", "number", "created"]).default("created").describe("Receipt sort column; defaults to created"),
  sortOrder: z.enum(["asc", "desc"]).default("desc").describe("Sort direction; defaults to desc"),
};
export const salesReceiptListSchema = z.object(salesReceiptListFields).strict();
export function salesReceiptListQuery(url: URL) {
  const q = url.searchParams;
  return salesReceiptListSchema.parse({ status: q.get("status") ?? undefined, contactId: q.get("contactId") ?? undefined,
    startDate: q.get("from") ?? undefined, endDate: q.get("to") ?? undefined,
    page: q.has("page") ? Number(q.get("page")) : undefined, limit: q.has("limit") ? Number(q.get("limit")) : undefined,
    sortBy: q.get("sortBy") ?? undefined, sortOrder: q.get("sortOrder") ?? undefined });
}
// Both existing transports round the extended major price before discount/tax.
export function salesReceiptTotals(lines: z.infer<typeof salesReceiptCreateFields.lines>, currency: string, rates: Map<string, number>) {
  return invoiceWriteTotals(lines, currency, false, rates);
}
type Header = { subtotal: number; taxTotal: number; total: number };
export function salesReceiptDto<T extends Header>(row: T) {
  const dto = publicMoneyDto(row, ["subtotal", "taxTotal", "total"]); stringifyWire(dto); return dto;
}
export function salesReceiptBalances(row: Header, lines: { unitPrice: number; amount: number; taxAmount: number; quantity: number; discountPercent: number }[]) {
  salesReceiptDto(row); lines.forEach(line => {
    publicLineDto(line);
    if (!Number.isInteger(line.quantity) || line.quantity < -2147483648 || line.quantity > 2147483647 ||
      !Number.isInteger(line.discountPercent) || line.discountPercent < 0 || line.discountPercent > 10000)
      invoiceInputError("Invalid stored sales receipt quantity or discount");
  });
  if (safeInvoiceMinor(lines.reduce((sum, line) => sum + BigInt(line.amount), 0n)) !== row.subtotal ||
    safeInvoiceMinor(lines.reduce((sum, line) => sum + BigInt(line.taxAmount), 0n)) !== row.taxTotal ||
    safeInvoiceMinor(BigInt(row.subtotal) + BigInt(row.taxTotal)) !== row.total)
    invoiceInputError("Sales receipt header and line balances must agree");
}
export async function readSalesReceiptJson(request: Request, empty = false): Promise<unknown> {
  const text = await request.text();
  if (empty && !text.trim()) return {};
  try { return JSON.parse(text); }
  catch { throw new z.ZodError([{ code: "custom", path: [], message: "Invalid sales receipt JSON body" }]); }
}
