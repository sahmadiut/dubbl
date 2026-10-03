import { z } from "zod";
import { rateDateSchema } from "@/lib/currency/rate-policy";
import { WireCompatibilityError } from "@/lib/money/wire";
import { invoiceDecimalRatio, invoiceInputError, invoiceRound, safeInvoiceMinor } from "./invoice-write-wire";
import { publicMoneyDto } from "./public-money-wire";

export const goodsReceiptQuantityFields = {
  purchaseOrderLineId: z.string().uuid().describe("UUID of a line belonging to the source purchase order; duplicates reject"),
  quantity: z.number().positive().max(21474836.47).optional().describe("Physical units received now; rounded to positive int32 hundredths; stock requires whole units"),
  quantityExact: z.string().max(40).regex(/^(?:0|[1-9]\d{0,7})(?:\.\d{1,18})?$/).optional()
    .describe("Exact ASCII decimal physical units, not money; must agree with quantity when both supplied; stock requires whole units"),
};
export const goodsReceiptCreateFields = {
  purchaseOrderId: z.string().uuid().describe("Organization-owned sent/partial/received/closed purchase order UUID"),
  date: rateDateSchema.describe("Unlocked Gregorian receipt date YYYY-MM-DD; posting FX is resolved on this date"),
  notes: z.string().nullable().optional().describe("Optional receipt notes; null or omission stores null"),
  lines: z.array(z.object(goodsReceiptQuantityFields).strict()).min(1).max(1000)
    .describe("1 through 1000 unique PO line selections; prices are copied from saved PO minor-unit costs"),
};
export const goodsReceiptCreateSchema = z.object(goodsReceiptCreateFields).strict();
export const goodsReceiptListFields = {
  purchaseOrderId: z.string().uuid().optional().describe("Optional source purchase order UUID filter"),
  status: z.enum(["draft", "received", "billed", "void"]).optional().describe("Optional goods receipt status filter"),
  page: z.number().int().min(1).max(21474836).default(1).describe("Page starting at 1, bounded for SQL offset"),
  limit: z.number().int().min(1).max(100).default(50).describe("Page size 1 through 100, defaults 50"),
};
export const goodsReceiptListSchema = z.object(goodsReceiptListFields);
export const goodsReceiptIdFields = {
  goodsReceiptId: z.string().uuid().describe("Organization-owned goods receipt UUID"),
};
export async function readGoodsReceiptJson(request: Request): Promise<unknown> {
  try { return await request.json(); } catch { invoiceInputError("Invalid goods receipt JSON"); }
}

export function goodsReceiptQuantity(input: { quantity?: number; quantityExact?: string }, stock: boolean) {
  if (input.quantity === undefined && input.quantityExact === undefined) invoiceInputError("Receipt quantity is required");
  const numeric = input.quantity === undefined ? undefined : invoiceDecimalRatio(input.quantity);
  const exact = input.quantityExact === undefined ? undefined : invoiceDecimalRatio(input.quantityExact);
  if (numeric && exact && numeric.numerator * exact.denominator !== exact.numerator * numeric.denominator)
    invoiceInputError("quantity and quantityExact disagree");
  const ratio = exact ?? numeric!;
  if (ratio.numerator <= 0n || (stock && ratio.numerator % ratio.denominator !== 0n))
    invoiceInputError("Receipt quantities must be positive; stock requires whole units");
  const scaled = invoiceRound(ratio.numerator * 100n, ratio.denominator);
  if (scaled < 1n || scaled > 2147483647n) invoiceInputError("Receipt quantity must round to positive int32 hundredths");
  return Number(scaled);
}
export function goodsReceiptAmount(quantity: number, unitCost: number) {
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 2147483647 || !Number.isSafeInteger(unitCost) || unitCost < 0)
    throw new WireCompatibilityError("Saved receipt requires positive int32 hundredths and nonnegative safe minor-unit cost");
  return safeInvoiceMinor(invoiceRound(BigInt(quantity) * BigInt(unitCost), 100n));
}
export function goodsReceiptLineDto<T extends { quantityReceived: number; unitCost: number }>(line: T) {
  goodsReceiptAmount(line.quantityReceived, line.unitCost);
  const qty = BigInt(line.quantityReceived);
  return { ...publicMoneyDto(line, ["unitCost"]), quantityReceivedExact: `${qty / 100n}.${String(qty % 100n).padStart(2, "0")}` };
}
