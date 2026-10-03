import { z } from "zod";
import { currencyCodeSchema } from "@/lib/currency/zod";
import { rateDateSchema } from "@/lib/currency/rate-policy";
import { exactMinorSchema, stringifyWire, WireCompatibilityError } from "@/lib/money/wire";
import { invoiceWriteLineFields, invoiceWriteLineSchema, invoiceWriteTotals, invoiceInputError, safeInvoiceMinor } from "./invoice-write-wire";
import { publicMoneyDto, publicLineDto } from "./public-money-wire";
import { contactDto } from "./contact-wire";

export const creditLineFields = {
  description: invoiceWriteLineFields.description, quantity: invoiceWriteLineFields.quantity,
  unitPrice: invoiceWriteLineFields.unitPrice, unitPriceExact: invoiceWriteLineFields.unitPriceExact,
  unitPriceMinor: invoiceWriteLineFields.unitPriceMinor, discountPercent: invoiceWriteLineFields.discountPercent,
  accountId: invoiceWriteLineFields.accountId, taxRateId: invoiceWriteLineFields.taxRateId,
  costCenterId: invoiceWriteLineFields.costCenterId,
};
export const creditMcpLineFields = { ...creditLineFields,
  unitPrice: z.number().int().min(-Number.MAX_SAFE_INTEGER).max(Number.MAX_SAFE_INTEGER).optional()
    .describe("Legacy integer currency minor-unit price (USD cents); must agree with exact aliases"),
};
export const creditCreateFields = {
  contactId: z.string().uuid().describe("Organization-owned customer contact UUID"),
  invoiceId: z.string().uuid().nullable().optional().describe("Optional original invoice UUID, same customer and currency"),
  issueDate: rateDateSchema.describe("Gregorian issue date, YYYY-MM-DD"),
  currencyCode: currencyCodeSchema.default("USD").describe("Document currency, defaults to USD; amounts are never rescaled"),
  reference: z.string().nullable().optional().describe("Optional external reference; null clears"),
  notes: z.string().nullable().optional().describe("Optional credit-note notes; null clears"),
  lines: z.array(z.object(creditLineFields).strict()).min(1).max(1000).describe("1 through 1000 tax-exclusive lines; omitted price is zero"),
};
export const creditMcpCreateFields = { ...creditCreateFields,
  lines: z.array(z.object(creditMcpLineFields).strict()).min(1).max(1000).describe("Credit lines; numeric unitPrice is integer minor units, unitPriceExact is decimal major units"),
};
export const creditUpdateFields = { ...creditCreateFields, contactId: creditCreateFields.contactId.optional().describe("Optional replacement organization-owned customer UUID"),
  issueDate: creditCreateFields.issueDate.optional().describe("Optional replacement Gregorian issue date; old and new dates must be open"), currencyCode: currencyCodeSchema.optional().describe("Replacement currency label; retained minor amounts are never rescaled"),
  lines: creditCreateFields.lines.optional().describe("Optional complete replacement lines; omitted prices are zero"),
};
export const creditMcpUpdateFields = { ...creditUpdateFields, lines: creditMcpCreateFields.lines.optional().describe("Optional complete replacement lines, numeric prices in integer minor units") };
export function parseCreditUpdate(input: unknown, transport: "rest" | "mcp") {
  return transport === "rest" ? z.object(creditUpdateFields).strict().parse(input) : z.object(creditMcpUpdateFields).strict().parse(input);
}
export function creditTotals(input: z.infer<typeof creditCreateFields.lines>, transport: "rest" | "mcp", currency: string, rates: Map<string, number>) {
  const lines = input.map(line => {
    if (transport === "rest" || line.unitPrice === undefined) return invoiceWriteLineSchema.parse(line);
    if (line.unitPriceMinor !== undefined && BigInt(line.unitPriceMinor) !== BigInt(line.unitPrice)) invoiceInputError("Credit price aliases disagree");
    return invoiceWriteLineSchema.parse({ ...line, unitPrice: undefined, unitPriceMinor: String(line.unitPrice) });
  });
  // Credit REST has always rounded the extended major price, rather than the unit price first.
  const totals = invoiceWriteTotals(lines, currency, false, rates);
  return { ...totals, processedLines: totals.processedLines.map(({ description, quantity, unitPrice, amount, taxAmount,
    accountId, taxRateId, costCenterId, discountPercent, sortOrder }) => ({ description, quantity, unitPrice, amount, taxAmount,
    accountId, taxRateId, costCenterId, discountPercent, sortOrder })) };
}
export const creditAmountFields = {
  amount: z.number().int().positive().max(Number.MAX_SAFE_INTEGER).optional().describe("Positive integer currency minor units (USD cents); must agree with amountMinor"),
  amountMinor: exactMinorSchema.optional().describe("Positive canonical integer minor-unit string within safe numeric range; must agree with amount"),
};
export function creditAmount(input: { amount?: number; amountMinor?: string }) {
  if (input.amount === undefined && input.amountMinor === undefined) invoiceInputError("amount or amountMinor is required");
  if (input.amount !== undefined && input.amountMinor !== undefined && BigInt(input.amount) !== BigInt(input.amountMinor)) invoiceInputError("Credit amount aliases disagree");
  const amount = safeInvoiceMinor(BigInt(input.amountMinor ?? input.amount!));
  if (amount <= 0) invoiceInputError("Credit amount must be positive"); return amount;
}
export const creditApplyFields = { invoiceId: creditCreateFields.contactId.describe("Same-customer, same-currency invoice UUID to settle"), ...creditAmountFields };
export const customerCreditApplyFields = { ...creditApplyFields, date: rateDateSchema.optional().describe("Gregorian posting date, defaults to today in UTC") };
export const customerCreditCreateFields = {
  contactId: creditCreateFields.contactId, date: rateDateSchema.describe("Gregorian date received, YYYY-MM-DD"), ...creditAmountFields,
  sourceType: z.enum(["prepayment", "overpayment", "credit_note"]).describe("Credit source label; this operation always records new cash and a deposit liability"),
  currencyCode: currencyCodeSchema.optional().describe("Currency defaults to contact, organization, then USD"), notes: creditCreateFields.notes,
  bankAccountId: z.string().uuid().nullable().optional().describe("Cash bank account UUID; mutually exclusive with depositAccountId"),
  depositAccountId: z.string().uuid().nullable().optional().describe("Cash asset chart account UUID; mutually exclusive with bankAccountId"),
};
export const creditListFields = {
  status: z.string().optional().describe("Optional status: draft/sent/applied/void for notes, open/applied/void/refunded for customer credits"),
  contactId: z.string().uuid().optional().describe("Optional customer contact UUID filter"),
  startDate: rateDateSchema.optional().describe("Inclusive Gregorian start date"), endDate: rateDateSchema.optional().describe("Inclusive Gregorian end date"),
  page: z.number().int().min(1).max(21474836).default(1).describe("Page starting at 1"),
  limit: z.number().int().min(1).max(100).default(50).describe("Page size, 1 through 100"),
  sortBy: z.enum(["date", "total", "amount", "remaining", "number", "created"]).default("created").describe("Sort column, defaults to created"),
  sortOrder: z.enum(["asc", "desc"]).default("desc").describe("Sort direction, defaults to desc"),
};
export function creditListQuery(url: URL) {
  const query = url.searchParams;
  return z.object(creditListFields).strict().parse({
    status: query.get("status") ?? undefined, contactId: query.get("contactId") ?? undefined,
    startDate: query.get("from") ?? undefined, endDate: query.get("to") ?? undefined,
    page: query.has("page") ? Number(query.get("page")) : undefined,
    limit: query.has("limit") ? Number(query.get("limit")) : undefined,
    sortBy: query.get("sortBy") ?? undefined, sortOrder: query.get("sortOrder") ?? undefined,
  });
}
export async function readCreditJson(request: Request): Promise<unknown> {
  try { return await request.json(); }
  catch { invoiceInputError("Invalid JSON credit body"); }
}
type Header = { subtotal: number; taxTotal: number; total: number; amountApplied: number; amountRemaining: number };
export function creditNoteDto<T extends Header>(row: T) {
  const dto = publicMoneyDto(row, ["subtotal", "taxTotal", "total", "amountApplied", "amountRemaining"]);
  safeInvoiceMinor(BigInt(row.total) - BigInt(row.amountApplied)); stringifyWire(dto); return dto;
}
export function customerCreditDto<T extends { originalAmount: number; amountRemaining: number }>(row: T) {
  const dto = publicMoneyDto(row, ["originalAmount", "amountRemaining"]);
  safeInvoiceMinor(BigInt(row.originalAmount) - BigInt(row.amountRemaining)); stringifyWire(dto); return dto;
}
type Related = { organizationId: string; creditLimit: number | null };
export function creditRelations<T extends { contact?: Related | null; journalEntry?: { organizationId: string } | null;
  lines?: { unitPrice: number; amount: number; taxAmount: number; account?: { organizationId: string } | null; taxRate?: { organizationId: string } | null }[] }>(row: T, org: string) {
  if ((row.contact && row.contact.organizationId !== org) || (row.journalEntry && row.journalEntry.organizationId !== org) ||
    row.lines?.some(line => (line.account && line.account.organizationId !== org) || (line.taxRate && line.taxRate.organizationId !== org)))
    throw new WireCompatibilityError("Credit contains a reference outside this organization");
  const result = { ...row, ...(row.contact ? { contact: contactDto(row.contact) } : {}), ...(row.lines ? { lines: row.lines.map(publicLineDto) } : {}) };
  stringifyWire(result); return result;
}
export function creditBalances(row: Header, lines: { amount: number; taxAmount: number; unitPrice: number }[]) {
  creditNoteDto(row); lines.forEach(publicLineDto);
  const subtotal = safeInvoiceMinor(lines.reduce((sum, line) => sum + BigInt(line.amount), 0n));
  const tax = safeInvoiceMinor(lines.reduce((sum, line) => sum + BigInt(line.taxAmount), 0n));
  if (subtotal !== row.subtotal || tax !== row.taxTotal || safeInvoiceMinor(BigInt(subtotal) + BigInt(tax)) !== row.total)
    invoiceInputError("Credit header and line balances must agree");
}
