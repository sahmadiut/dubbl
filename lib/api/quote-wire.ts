import { z } from "zod";
import { currencyCodeSchema } from "@/lib/currency/zod";
import { rateDateSchema } from "@/lib/currency/rate-policy";
import { stringifyWire, WireCompatibilityError } from "@/lib/money/wire";
import { invoiceWriteLineFields, invoiceWriteLineSchema, invoiceWriteTotals, invoiceDecimalRatio,
  invoiceRound, safeInvoiceMinor, invoiceInputError, type InvoiceWriteLine } from "./invoice-write-wire";
import { publicMoneyDto, publicLineDto } from "./public-money-wire";
import { contactDto } from "./contact-wire";
import { AuthError } from "./auth-context";

export const quoteLineFields = {
  description: invoiceWriteLineFields.description, quantity: invoiceWriteLineFields.quantity,
  unitPrice: invoiceWriteLineFields.unitPrice, unitPriceExact: invoiceWriteLineFields.unitPriceExact,
  unitPriceMinor: invoiceWriteLineFields.unitPriceMinor, discountPercent: invoiceWriteLineFields.discountPercent,
  accountId: invoiceWriteLineFields.accountId, taxRateId: invoiceWriteLineFields.taxRateId,
  costCenterId: invoiceWriteLineFields.costCenterId, inventoryItemId: invoiceWriteLineFields.inventoryItemId,
  priceListId: invoiceWriteLineFields.priceListId,
};
export const quoteMcpLineFields = { ...quoteLineFields,
  unitPrice: z.number().int().min(-Number.MAX_SAFE_INTEGER).max(Number.MAX_SAFE_INTEGER).optional()
    .describe("Legacy integer currency minor-unit price (USD cents), stored directly; must agree with exact price aliases"),
};
export const quoteCreateFields = {
  contactId: z.string().uuid().describe("Organization-owned customer UUID"),
  issueDate: rateDateSchema.describe("Gregorian issue date, YYYY-MM-DD"),
  expiryDate: rateDateSchema.describe("Gregorian expiry date, YYYY-MM-DD"),
  reference: z.string().nullable().optional().describe("Optional external reference; null clears"),
  notes: z.string().nullable().optional().describe("Optional quote notes; null clears"),
  currencyCode: currencyCodeSchema.default("USD").describe("Quote currency, defaults to USD; no implicit FX"),
  priceListId: invoiceWriteLineFields.priceListId,
  lines: z.array(z.object(quoteLineFields).strict()).min(1).max(1000).describe("1 through 1000 tax-exclusive quote lines; item/list used only for price lookup"),
};
export const quoteMcpCreateFields = { ...quoteCreateFields,
  lines: z.array(z.object(quoteMcpLineFields).strict()).min(1).max(1000).describe("Quote lines; numeric unitPrice is integer minor units; unitPriceExact is decimal major units"),
};
export const quoteUpdateFields = {
  contactId: quoteCreateFields.contactId.optional().describe("Optional replacement organization-owned customer UUID"),
  issueDate: quoteCreateFields.issueDate.optional().describe("Optional Gregorian issue date; old and new dates must be unlocked"),
  expiryDate: quoteCreateFields.expiryDate.optional().describe("Optional Gregorian expiry date"),
  reference: quoteCreateFields.reference, notes: quoteCreateFields.notes,
  currencyCode: currencyCodeSchema.optional().describe("Optional currency label; retained minor-unit amounts are never rescaled"),
  lines: quoteCreateFields.lines.optional().describe("Optional complete replacement lines; absent prices default to zero, no price lookup on update"),
};
export const quoteMcpUpdateFields = { ...quoteUpdateFields, lines: quoteMcpCreateFields.lines.optional().describe("Optional complete replacement lines with integer-minor numeric prices; no price lookup") };
export const quoteConvertFields = {
  percentage: z.number().gt(0).max(100).optional().describe("Share of original quote total this round, greater than zero through 100; omitted bills remaining"),
  lines: z.array(z.object({
    quoteLineId: z.string().uuid().describe("UUID of a line belonging to this quote; duplicates rejected"),
    quantity: z.number().gt(0).max(21474836.47).describe("Physical quantity in units, rounded to positive int32 hundredths"),
  }).strict()).max(1000).optional().describe("Milestone quantities; nonempty lines take precedence over percentage"),
};
export const quoteConvertSchema = z.object(quoteConvertFields).strict();
export const quoteListFields = {
  status: z.enum(["draft", "sent", "accepted", "declined", "expired", "converted"]).optional().describe("Optional quote status filter"),
  page: z.number().int().min(1).max(21474836).default(1).describe("Page number starting at 1"),
  limit: z.number().int().min(1).max(100).default(50).describe("Page size, 1 through 100; defaults to 50"),
};
export const quoteListSchema = z.object(quoteListFields);
export function parseQuoteCreate(input: unknown, transport: "rest" | "mcp") {
  return z.object(transport === "rest" ? quoteCreateFields : quoteMcpCreateFields).strict().parse(input);
}
export function parseQuoteUpdate(input: unknown, transport: "rest" | "mcp") {
  return z.object(transport === "rest" ? quoteUpdateFields : quoteMcpUpdateFields).strict().parse(input);
}
export function quoteInputLines(lines: z.infer<typeof quoteCreateFields.lines>, transport: "rest" | "mcp"): InvoiceWriteLine[] {
  return lines.map(line => {
    if (transport === "rest" || line.unitPrice === undefined) return invoiceWriteLineSchema.parse(line);
    if (line.unitPriceMinor !== undefined && BigInt(line.unitPriceMinor) !== BigInt(line.unitPrice)) invoiceInputError("Quote price aliases disagree");
    return invoiceWriteLineSchema.parse({ ...line, unitPrice: undefined, unitPriceMinor: BigInt(line.unitPrice).toString() });
  });
}
export function quoteTotals(lines: InvoiceWriteLine[], currency: string, rates: Map<string, number>, fallback: number[] = []) {
  const totals = invoiceWriteTotals(lines, currency, true, rates, fallback);
  return { ...totals, processedLines: totals.processedLines.map(({ description, quantity, unitPrice, accountId, taxRateId,
    costCenterId, discountPercent, taxAmount, amount, sortOrder }) => ({ description, quantity, unitPrice, accountId, taxRateId,
    costCenterId, discountPercent, taxAmount, amount, sortOrder })) };
}
type Header = { subtotal: number; taxTotal: number; total: number; billedTotal: number };
export function quoteDto<T extends Header>(row: T) {
  const dto = publicMoneyDto(row, ["subtotal", "taxTotal", "total", "billedTotal"]);
  safeInvoiceMinor(BigInt(row.total) - BigInt(row.billedTotal)); stringifyWire(dto); return dto;
}
type Related = { organizationId: string; creditLimit: number | null };
type QuoteLine = { id: string; description: string; quantity: number; unitPrice: number; amount: number; taxAmount: number;
  discountPercent: number; accountId: string | null; taxRateId: string | null; costCenterId: string | null; sortOrder: number };
export function quoteReadDto<T extends Header & { contact: Related | null; lines?: (QuoteLine & {
  account?: { organizationId: string } | null; taxRate?: { organizationId: string } | null })[] }>(row: T, orgId: string) {
  if ((row.contact && row.contact.organizationId !== orgId) || row.lines?.some(line =>
    (line.account && line.account.organizationId !== orgId) || (line.taxRate && line.taxRate.organizationId !== orgId)))
    throw new WireCompatibilityError("Quote contains a reference outside this organization");
  const dto = { ...quoteDto(row), contact: row.contact ? contactDto(row.contact) : null,
    ...(row.lines ? { lines: row.lines.map(publicLineDto) } : {}) };
  stringifyWire(dto); return dto;
}
export function validateQuoteBalances(header: Header, lines: QuoteLine[]) {
  quoteDto(header);
  const sum = (field: "amount" | "taxAmount") => safeInvoiceMinor(lines.reduce((s, line) => s + BigInt(line[field]), 0n));
  if (sum("amount") !== header.subtotal || sum("taxAmount") !== header.taxTotal ||
    safeInvoiceMinor(BigInt(header.subtotal) + BigInt(header.taxTotal)) !== header.total || header.billedTotal < 0 ||
    (header.billedTotal > 0 && header.billedTotal > header.total)) invoiceInputError("Quote header and line balances must agree");
}
export class QuoteOverbillingError extends AuthError {
  readonly amounts;
  constructor(remaining: number, requested: number) {
    super("Requested amount exceeds the un-billed balance of the quote", 400);
    this.amounts = publicMoneyDto({ remaining, requested }, ["remaining", "requested"]);
  }
}
/** Original percentage rounding is preserved; the final remaining round allocates the exact residual. */
export function quoteBilling(header: Header, saved: QuoteLine[], input: z.infer<typeof quoteConvertSchema>) {
  quoteDto(header);
  const lines = [...saved].sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
  lines.forEach(line => {
    publicLineDto(line);
    if (!Number.isInteger(line.quantity) || line.quantity < -2147483648 || line.quantity > 2147483647 ||
      !Number.isInteger(line.discountPercent) || line.discountPercent < 0 || line.discountPercent > 10000)
      invoiceInputError("Invalid stored quote quantity or discount");
  });
  validateQuoteBalances(header, lines);
  const remaining = BigInt(header.total) - BigInt(header.billedTotal);
  if (remaining <= 0n) invoiceInputError("Quote is already fully billed");
  const clean = (line: QuoteLine, sortOrder: number) => ({ description: line.description, quantity: line.quantity, unitPrice: line.unitPrice,
    accountId: line.accountId, taxRateId: line.taxRateId, costCenterId: line.costCenterId,
    discountPercent: line.discountPercent, amount: line.amount, taxAmount: line.taxAmount, sortOrder });
  let billLines;
  if (input.lines?.length) {
    const ids = new Set<string>();
    billLines = input.lines.map((selection, i) => {
      if (ids.has(selection.quoteLineId)) invoiceInputError("Duplicate milestone quote line"); ids.add(selection.quoteLineId);
      const line = lines.find(row => row.id === selection.quoteLineId);
      if (!line) invoiceInputError("Milestone line does not belong to this quote");
      const qty = invoiceDecimalRatio(selection.quantity), quantity = Number(invoiceRound(qty.numerator * 100n, qty.denominator));
      if (quantity <= 0 || quantity > 2147483647) invoiceInputError("Milestone quantity must round to positive int32 hundredths");
      const gross = invoiceRound(BigInt(line.unitPrice) * BigInt(quantity), 100n); safeInvoiceMinor(gross);
      const amount = gross - invoiceRound(gross * BigInt(line.discountPercent), 10000n);
      const taxAmount = line.amount > 0 ? invoiceRound(BigInt(line.taxAmount) * amount, BigInt(line.amount)) : 0n;
      return { ...clean(line, i), quantity, amount: safeInvoiceMinor(amount), taxAmount: safeInvoiceMinor(taxAmount) };
    });
  } else {
    const pct = input.percentage === undefined ? undefined : invoiceDecimalRatio(input.percentage);
    const numerator = pct ? pct.numerator : remaining, denominator = pct ? pct.denominator * 100n : BigInt(header.total);
    let cumulative = 0n, allocated = 0n;
    const portion = (value: number) => {
      if (pct) return safeInvoiceMinor(invoiceRound(BigInt(value) * numerator, denominator));
      cumulative += BigInt(value);
      const target = invoiceRound(cumulative * numerator, denominator), result = target - allocated;
      allocated = target; return safeInvoiceMinor(result);
    };
    billLines = lines.map((line, i) => ({ ...clean(line, i),
      quantity: Number(invoiceRound(BigInt(line.quantity) * numerator, denominator)), amount: portion(line.amount), taxAmount: portion(line.taxAmount) }));
  }
  const subtotal = safeInvoiceMinor(billLines.reduce((s, line) => s + BigInt(line.amount), 0n));
  const taxTotal = safeInvoiceMinor(billLines.reduce((s, line) => s + BigInt(line.taxAmount), 0n));
  const total = safeInvoiceMinor(BigInt(subtotal) + BigInt(taxTotal));
  if (total <= 0) invoiceInputError("Nothing to bill: requested portion totals zero");
  if (BigInt(total) > remaining) throw new QuoteOverbillingError(safeInvoiceMinor(remaining), total);
  const billedTotal = safeInvoiceMinor(BigInt(header.billedTotal) + BigInt(total));
  return { billLines, subtotal, taxTotal, total, billing: publicMoneyDto({ invoiced: total, billedTotal,
    remaining: safeInvoiceMinor(BigInt(header.total) - BigInt(billedTotal)), fullyBilled: billedTotal === header.total }, ["invoiced", "billedTotal", "remaining"]) };
}
