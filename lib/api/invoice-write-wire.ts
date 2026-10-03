import { z } from "zod";
import { currencyCodeSchema } from "@/lib/currency/zod";
import { rateDateSchema } from "@/lib/currency/rate-policy";
import { currencyMetadata, roundRatio } from "@/lib/money/exact";
import { exactMinorSchema, WireCompatibilityError } from "@/lib/money/wire";
import { publicMoneyDto } from "./public-money-wire";

const dimension = (name: string) => z.string().uuid().nullable().optional().describe(`Optional organization-owned ${name} UUID; null clears`);
const decimalSchema = z.string().max(40).regex(/^-?(?:0|[1-9]\d{0,19})(?:\.\d{1,18})?$/)
  .describe("ASCII decimal major-unit price, at most 20 whole and 18 fractional digits; no exponent or localized digits");
export const invoiceWriteLineFields = {
  description: z.string().min(1).describe("Nonempty invoice line description"),
  quantity: z.number().min(-21474836.48).max(21474836.47).default(1).describe("Decimal physical quantity; rounded to signed int32 hundredths for storage, defaults to 1"),
  unitPrice: z.number().min(-Number.MAX_SAFE_INTEGER).max(Number.MAX_SAFE_INTEGER).optional().describe("Optional legacy decimal major-unit price, e.g. USD 12.50; omission permits create price lookup"),
  unitPriceExact: decimalSchema.optional().describe("Optional exact decimal major-unit price string; must agree with unitPrice when both supplied"),
  unitPriceMinor: exactMinorSchema.optional().describe("Optional integer currency minor-unit price string, limited to safe integers; must agree with the rounded major price"),
  discountPercent: z.number().int().min(0).max(10000).default(0).describe("Discount basis points; 1000 = 10%, defaults to 0"),
  accountId: dimension("revenue account"), taxRateId: dimension("tax rate"),
  costCenterId: dimension("cost center"), projectId: dimension("project"),
  inventoryItemId: dimension("inventory item"), warehouseId: dimension("warehouse"),
  priceListId: dimension("price list"),
};
export const invoiceWriteLineSchema = z.object(invoiceWriteLineFields);
export const invoiceCreateFields = {
  contactId: z.string().uuid().describe("Organization-owned customer contact UUID"),
  issueDate: rateDateSchema.describe("Canonical Gregorian issue date, YYYY-MM-DD"),
  dueDate: rateDateSchema.optional().describe("Gregorian due date; omission uses contact or organization payment terms"),
  reference: z.string().nullable().optional().describe("Optional external reference; null clears"),
  notes: z.string().nullable().optional().describe("Optional invoice notes; null clears"),
  currencyCode: currencyCodeSchema.optional().describe("Explicit invoice currency; REST defaults contact/org/USD, MCP defaults USD"),
  priceListId: dimension("document price list"),
  lines: z.array(invoiceWriteLineSchema).min(1).max(1000).describe("1 through 1000 line items"),
  enforceCreditLimit: z.boolean().optional().describe("Reject with 403 instead of a soft warning when the customer's credit limit is exceeded"),
  invoiceType: z.enum(["standard", "deposit", "retainer"]).default("standard").describe("Document flavour; all are normal AR documents"),
  depositPercent: z.number().int().min(0).max(10000).nullable().optional().describe("Optional deposit basis points; 2500 = 25%"),
  submitForApproval: z.boolean().default(false).describe("Create pending approval only if a matching active workflow has steps; otherwise draft"),
};
export const invoiceCreateSchema = z.object(invoiceCreateFields);
export const invoiceUpdateFields = {
  issueDate: rateDateSchema.optional().describe("Optional replacement Gregorian issue date; both old and new dates must be unlocked"),
  dueDate: rateDateSchema.optional().describe("Optional replacement Gregorian due date"),
  reference: invoiceCreateFields.reference, notes: invoiceCreateFields.notes,
  lines: z.array(invoiceWriteLineSchema).min(1).max(1000).optional().describe("Optional complete replacement of line items; omitted prices default to zero on update"),
};
export const invoiceUpdateSchema = z.object(invoiceUpdateFields);
export type InvoiceWriteLine = z.infer<typeof invoiceWriteLineSchema>;

export function invoiceInputError(message: string): never {
  throw new z.ZodError([{ code: "custom", path: ["lines"], message }]);
}
export function safeInvoiceMinor(value: bigint): number {
  const max = BigInt(Number.MAX_SAFE_INTEGER);
  if (value < -max || value > max) throw new WireCompatibilityError("Invoice amount, product or sum exceeds the safe numeric workflow range");
  return Number(value);
}
// Interpret a numeric client's shortest decimal spelling, including scientific notation,
// without multiplying binary floats. Exact strings never permit scientific notation.
export function invoiceDecimalRatio(value: number | string) {
  const spelling = String(value);
  const match = /^(-?)(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/.exec(spelling);
  if (!match) invoiceInputError("Invalid decimal price or quantity");
  const fraction = match[3] ?? "";
  const exponent = Number(match[4] ?? 0) - fraction.length;
  let numerator = BigInt(match[2] + fraction) * (match[1] ? -1n : 1n);
  let denominator = 1n;
  if (exponent >= 0) numerator *= 10n ** BigInt(exponent);
  else denominator = 10n ** BigInt(-exponent);
  return { numerator, denominator };
}
/** Matches Math.round's signed tie toward +infinity, using integer ratios. */
export function invoiceRound(numerator: bigint, denominator: bigint) {
  return roundRatio(2n * numerator + denominator, 2n * denominator, "floor");
}
export function hasInvoicePrice(line: InvoiceWriteLine) {
  return line.unitPrice !== undefined || line.unitPriceExact !== undefined || line.unitPriceMinor !== undefined;
}
export function invoicePrice(line: InvoiceWriteLine, currency: string, fallback = 0) {
  const scale = 10n ** BigInt(currencyMetadata(currency).minorUnits);
  const numeric = line.unitPrice === undefined ? undefined : invoiceDecimalRatio(line.unitPrice);
  const exact = line.unitPriceExact === undefined ? undefined : invoiceDecimalRatio(line.unitPriceExact);
  if (numeric && exact && numeric.numerator * exact.denominator !== exact.numerator * numeric.denominator) {
    invoiceInputError("unitPrice and unitPriceExact disagree");
  }
  const major = exact ?? numeric;
  const minor = major ? invoiceRound(major.numerator * scale, major.denominator) : BigInt(line.unitPriceMinor ?? fallback);
  if (line.unitPriceMinor !== undefined && BigInt(line.unitPriceMinor) !== minor) invoiceInputError("unitPriceMinor and rounded major price disagree");
  safeInvoiceMinor(minor);
  return { minor, numerator: major ? major.numerator * scale : minor, denominator: major?.denominator ?? 1n };
}
/** REST create rounds price first; PATCH/MCP create round the extended major price. */
export function invoiceWriteTotals(lines: InvoiceWriteLine[], currency: string, roundPriceFirst: boolean,
  rates: Map<string, number>, fallbackPrices: number[] = []) {
  let subtotal = 0n, taxTotal = 0n;
  const processedLines = lines.map((line, sortOrder) => {
    const price = invoicePrice(line, currency, fallbackPrices[sortOrder] ?? 0);
    const qty = invoiceDecimalRatio(line.quantity);
    const quantity = Number(invoiceRound(qty.numerator * 100n, qty.denominator));
    if (!Number.isInteger(quantity) || quantity < -2147483648 || quantity > 2147483647) invoiceInputError("Quantity exceeds signed int32 hundredths");
    const gross = invoiceRound(qty.numerator * (roundPriceFirst ? price.minor : price.numerator), qty.denominator * (roundPriceFirst ? 1n : price.denominator));
    safeInvoiceMinor(gross);
    const discount = invoiceRound(gross * BigInt(line.discountPercent), 10000n);
    const amount = gross - discount;
    safeInvoiceMinor(amount);
    const rate = line.taxRateId ? rates.get(line.taxRateId) : 0;
    if (rate === undefined || !Number.isSafeInteger(rate) || rate < 0 || rate > 2147483647) invoiceInputError("Invalid or missing tax rate");
    const taxAmount = invoiceRound(amount * BigInt(rate), 10000n);
    safeInvoiceMinor(taxAmount);
    subtotal += amount; taxTotal += taxAmount;
    return { description: line.description, quantity, unitPrice: Number(price.minor), discountPercent: line.discountPercent,
      amount: Number(amount), taxAmount: Number(taxAmount), accountId: line.accountId ?? null, taxRateId: line.taxRateId ?? null,
      costCenterId: line.costCenterId ?? null, projectId: line.projectId ?? null, inventoryItemId: line.inventoryItemId ?? null,
      warehouseId: line.warehouseId ?? null, sortOrder };
  });
  return { processedLines, subtotal: safeInvoiceMinor(subtotal), taxTotal: safeInvoiceMinor(taxTotal), total: safeInvoiceMinor(subtotal + taxTotal) };
}
export function invoiceWriteDto<T extends { subtotal: number; taxTotal: number; total: number; amountPaid: number; amountDue: number }>(row: T) {
  return publicMoneyDto(row, ["subtotal", "taxTotal", "total", "amountPaid", "amountDue"]);
}
