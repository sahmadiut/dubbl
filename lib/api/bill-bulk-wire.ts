import { z } from "zod";
import { currencyCodeSchema } from "@/lib/currency/zod";
import { rateDateSchema } from "@/lib/currency/rate-policy";
import { exactMinorSchema } from "@/lib/money/wire";
import { currencyMetadata } from "@/lib/money/exact";
import { parseDate } from "@/lib/import-export/transformers";
import { invoiceImportSource } from "./invoice-bulk-wire";
import { invoiceWriteLineFields, invoicePrice, invoiceDecimalRatio, invoiceRound, invoiceInputError, safeInvoiceMinor } from "./invoice-write-wire";
import { publicMoneyDto } from "./public-money-wire";

const decimal = invoiceWriteLineFields.unitPriceExact.unwrap();
export const billImportRowSchema = z.object({
  billNumber: z.string().optional().describe("External line grouping key only; omitted/blank creates a separate bill per row"),
  contactName: z.string().trim().min(1).describe("Literal case-insensitive available supplier name in this organization; ambiguous names reject"),
  issueDate: rateDateSchema.describe("Gregorian issue date, YYYY-MM-DD"),
  dueDate: rateDateSchema.describe("Gregorian due date, YYYY-MM-DD"),
  currencyCode: currencyCodeSchema.default("USD").describe("Document currency; omission preserves legacy USD import default"),
  lineDescription: z.string().min(1).describe("Nonempty line description"),
  lineQuantity: z.union([z.number().min(-21474837).max(21474837), z.string().max(28).regex(/^-?(?:0|[1-9]\d{0,7})(?:\.\d{1,18})?$/), z.literal("")])
    .default(1).describe("Physical decimal quantity, numeric or CSV text; stored as signed int32 hundredths, defaults to 1 (blank CSV is zero)"),
  lineUnitPrice: z.union([invoiceWriteLineFields.unitPrice.unwrap(), decimal, z.literal("")]).optional()
    .describe("Legacy decimal major-unit price, numeric or canonical CSV decimal text; blank/omitted defaults to zero"),
  lineUnitPriceExact: invoiceWriteLineFields.unitPriceExact.describe("Exact canonical decimal major-unit price; must agree with lineUnitPrice"),
  lineUnitPriceMinor: exactMinorSchema.optional().describe("Integer currency minor-unit price string; must agree with rounded major price and fit safe Number range"),
  lineAmount: z.union([invoiceWriteLineFields.unitPrice.unwrap(), z.string().max(80)]).optional()
    .describe("Optional extended amount override in major units; text supports US/European grouping, currency symbols and negative parentheses; blank means absent"),
  lineAmountExact: decimal.optional().describe("Exact canonical decimal major-unit extended amount override; must agree with lineAmount"),
  lineAmountMinor: exactMinorSchema.optional().describe("Integer currency minor-unit extended amount override; must agree with rounded major override"),
  lineAccountCode: z.string().optional().describe("Literal case-insensitive active account code in this organization; blank means no account"),
});
export type BillImportRow = z.infer<typeof billImportRowSchema>;
export const billImportFields = {
  source: invoiceImportSource,
  rows: z.array(z.record(z.string(), z.unknown())).min(1).max(1000)
    .describe("1 through 1000 flat CSV-mapped bill lines grouped by external billNumber; grouped supplier/dates/currency must agree"),
};
export const billImportSchema = z.object({ ...billImportFields,
  fileName: z.string().min(1).max(255).describe("Import filename for job history"),
});
export const mcpBillImportFields = { source: invoiceImportSource,
  rows: z.array(billImportRowSchema.extend({
    issueDate: z.string().min(1).describe("Gregorian issue date or supported source date spelling"),
    dueDate: z.string().min(1).describe("Gregorian due date or supported source date spelling"),
  })).min(1).max(1000).describe("Flat bill lines using REST CSV format; prices/amount overrides use major units or named Minor strings"),
};
export function normalizeBillImportRows(rows: Record<string, unknown>[], source: z.infer<typeof invoiceImportSource>): Record<string, unknown>[] {
  return rows.map(row => ({ ...row,
    issueDate: typeof row.issueDate === "string" ? parseDate(row.issueDate, source) : row.issueDate,
    dueDate: typeof row.dueDate === "string" ? parseDate(row.dueDate, source) : row.dueDate,
  }));
}
export function billImportGroups(rows: BillImportRow[]) {
  const groups = new Map<string, { rows: BillImportRow[]; indices: number[] }>();
  for (const [index, row] of rows.entries()) {
    const key = row.billNumber ? `number:${row.billNumber}` : `row:${index}`;
    const group = groups.get(key);
    const header = (value: BillImportRow) => JSON.stringify([value.contactName.toLowerCase(), value.issueDate, value.dueDate, value.currencyCode]);
    if (group && header(group.rows[0]) !== header(row)) invoiceInputError("Grouped bill supplier, dates and currency must agree");
    if (group) { group.rows.push(row); group.indices.push(index); }
    else groups.set(key, { rows: [row], indices: [index] });
  }
  return [...groups.values()];
}
/** Retain well-formed CSV money spellings without parseFloat or silent junk-to-zero. */
export function billImportAmount(value: number | string) {
  if (typeof value === "number") return { decimal: value, parentheses: false };
  let text = value.trim();
  const parentheses = text.startsWith("(") && text.endsWith(")");
  if (parentheses) text = text.slice(1, -1);
  text = text.replace(/^[\$€£¥]|[\$€£¥]$/g, "").trim();
  if (/^-?\d{1,3}(?:\.\d{3})+,\d{1,2}$/.test(text)) text = text.replaceAll(".", "").replace(",", ".");
  else if (/^-?\d{1,3}(?:,\d{3})+(?:\.\d{1,18})?$/.test(text)) text = text.replaceAll(",", "");
  const parsed = decimal.parse(text);
  if (parentheses && parsed.startsWith("-")) invoiceInputError("Parenthesized amounts must contain an unsigned value");
  return { decimal: parentheses ? `-${parsed}` : parsed, parentheses };
}
export function billImportLine(row: BillImportRow) {
  const numericPrice = row.lineUnitPrice === "" ? undefined : row.lineUnitPrice;
  if (typeof numericPrice === "string" && row.lineUnitPriceExact !== undefined) {
    const a = invoiceDecimalRatio(numericPrice), b = invoiceDecimalRatio(row.lineUnitPriceExact);
    if (a.numerator * b.denominator !== b.numerator * a.denominator) invoiceInputError("Major unit price aliases disagree");
  }
  const price = invoicePrice({ description: row.lineDescription, quantity: 1, discountPercent: 0,
    unitPrice: typeof numericPrice === "number" ? numericPrice : undefined,
    unitPriceExact: row.lineUnitPriceExact ?? (typeof numericPrice === "string" ? numericPrice : undefined),
    unitPriceMinor: row.lineUnitPriceMinor }, row.currencyCode);
  const qty = invoiceDecimalRatio(row.lineQuantity === "" ? 0 : row.lineQuantity);
  const quantity = invoiceRound(qty.numerator * 100n, qty.denominator);
  if (quantity < -2147483648n || quantity > 2147483647n) invoiceInputError("Quantity exceeds signed int32 hundredths");
  const gross = invoiceRound(qty.numerator * price.numerator, qty.denominator * price.denominator);
  safeInvoiceMinor(gross); // Overrides cannot hide an unsupported product.
  const supplied = row.lineAmount !== undefined && row.lineAmount !== "" && !(typeof row.lineAmount === "string" && row.lineAmount.trim() === "");
  const legacy = supplied ? billImportAmount(row.lineAmount!) : undefined;
  const majorAmount = row.lineAmountExact ?? legacy?.decimal;
  if (legacy && row.lineAmountExact !== undefined) {
    const a = invoiceDecimalRatio(legacy.decimal), b = invoiceDecimalRatio(row.lineAmountExact);
    if (a.numerator * b.denominator !== b.numerator * a.denominator) invoiceInputError("Major line amount aliases disagree");
  }
  let override: bigint | undefined;
  if (majorAmount !== undefined) {
    const ratio = invoiceDecimalRatio(majorAmount), scale = 10n ** BigInt(currencyMetadata(row.currencyCode).minorUnits);
    // Legacy parentheses round positive magnitude then negate.
    override = legacy?.parentheses ? -invoiceRound(-ratio.numerator * scale, ratio.denominator)
      : invoiceRound(ratio.numerator * scale, ratio.denominator);
    safeInvoiceMinor(override);
  }
  if (row.lineAmountMinor !== undefined) {
    const minor = BigInt(row.lineAmountMinor); safeInvoiceMinor(minor);
    if (override !== undefined && override !== minor) invoiceInputError("Minor and rounded major line amount aliases disagree");
    override = minor;
  }
  return { description: row.lineDescription, quantity: Number(quantity), unitPrice: Number(price.minor),
    amount: safeInvoiceMinor(override ?? gross), taxAmount: 0, taxRateId: null, discountPercent: 0 };
}
export function billImportTotals(rows: BillImportRow[]) {
  const lines = rows.map(billImportLine);
  const subtotal = safeInvoiceMinor(lines.reduce((sum, line) => sum + BigInt(line.amount), 0n));
  return { lines, subtotal, taxTotal: 0, total: subtotal, amountDue: subtotal };
}
export function billImportPreviewDto(row: BillImportRow) {
  const line = billImportLine(row);
  return publicMoneyDto({ ...line, currencyCode: row.currencyCode }, ["unitPrice", "amount", "taxAmount"]);
}
