import { z } from "zod";
import { currencyCodeSchema } from "@/lib/currency/zod";
import { rateDateSchema } from "@/lib/currency/rate-policy";
import { parseDate } from "@/lib/import-export/transformers";
import { invoiceWriteLineSchema, invoiceWriteLineFields, invoiceWriteTotals, invoiceInputError, invoiceDecimalRatio } from "./invoice-write-wire";
import { money, toMajorDecimal, currencyMetadata } from "@/lib/money/exact";
import { publicMoneyDto } from "./public-money-wire";

export const invoiceImportSource = z.enum(["quickbooks", "xero", "freshbooks", "wave", "custom"]).default("custom")
  .describe("Source date format; prices always use decimal major units, never source-dependent rescaling");
export const invoiceImportRowSchema = z.object({
  contactId: z.string().uuid().describe("Available organization-owned customer UUID"),
  issueDate: rateDateSchema.describe("Gregorian issue date"),
  dueDate: rateDateSchema.describe("Gregorian due date"),
  reference: z.string().nullable().optional().describe("Optional external reference"),
  currencyCode: currencyCodeSchema.default("USD").describe("Document currency; preserves legacy import default USD"),
  lines: z.array(invoiceWriteLineSchema.omit({ priceListId: true }).strict()).min(1).max(1000)
    .describe("Complete document lines; omitted prices default to zero, no price lookup"),
}).strict();
export type InvoiceImportRow = z.infer<typeof invoiceImportRowSchema>;
export const invoiceImportFields = {
  source: invoiceImportSource,
  rows: z.array(z.record(z.string(), z.unknown())).min(1).max(1000)
    .describe("Nested invoice documents or flat CSV-mapped lines; flat invoiceNumber groups lines, otherwise contact/date/reference group them. Numeric unitPrice is decimal major units; unitPriceExact is an exact decimal and unitPriceMinor is an integer minor string"),
};
export const invoiceImportSchema = z.object({ ...invoiceImportFields,
  fileName: z.string().min(1).max(255).describe("Import filename for the job history"),
});
export const invoiceBulkIdsFields = {
  ids: z.array(z.string().uuid().describe("Organization-owned invoice UUID")).min(1).max(100)
    .describe("1 through 100 invoice IDs; duplicates ignored"),
};
export const invoiceReminderFields = {
  invoiceIds: z.array(z.string().uuid().describe("Organization-owned invoice UUID")).min(1).max(200)
    .describe("1 through 200 invoice IDs; duplicates ignored"),
};
export const invoiceBulkActionSchema = z.object({
  action: z.enum(["send-reminder", "mark-as-sent"]).describe("Send reminders or atomically recognize selected drafts"),
  ...invoiceReminderFields,
});

const flatSchema = z.object({
  invoiceNumber: z.string().optional().describe("External grouping key, not the generated document number"),
  contactId: invoiceImportRowSchema.shape.contactId,
  issueDate: invoiceImportRowSchema.shape.issueDate,
  dueDate: invoiceImportRowSchema.shape.dueDate,
  reference: invoiceImportRowSchema.shape.reference,
  currencyCode: invoiceImportRowSchema.shape.currencyCode,
  lineDescription: invoiceWriteLineFields.description,
  lineQuantity: z.union([invoiceWriteLineFields.quantity, z.string().regex(/^-?(?:0|[1-9]\d{0,7})(?:\.\d{1,2})?$/)])
    .optional().describe("Physical quantity; CSV decimal strings allow at most two fractional digits"),
  lineUnitPrice: z.union([invoiceWriteLineFields.unitPrice.unwrap(), invoiceWriteLineFields.unitPriceExact.unwrap()])
    .optional().describe("Legacy numeric or CSV canonical decimal major-unit price"),
  lineUnitPriceExact: invoiceWriteLineFields.unitPriceExact,
  lineUnitPriceMinor: invoiceWriteLineFields.unitPriceMinor,
  lineAccountId: invoiceWriteLineFields.accountId,
  lineTaxRateId: invoiceWriteLineFields.taxRateId,
}).strict();

const importDateFields = {
  issueDate: z.string().min(1).describe("Issue date, Gregorian YYYY-MM-DD or supported source date spelling"),
  dueDate: z.string().min(1).describe("Due date, Gregorian YYYY-MM-DD or supported source date spelling"),
};
export const mcpInvoiceImportFields = {
  source: invoiceImportSource,
  rows: z.array(z.union([invoiceImportRowSchema.extend(importDateFields), flatSchema.extend(importDateFields)]))
    .min(1).max(1000).describe("Nested invoice documents or flat mapped CSV lines; all headers in a flat group must agree"),
};

export function invoiceImportGroups(raw: Record<string, unknown>[], source: z.infer<typeof invoiceImportSource>) {
  const groups = new Map<string, Record<string, unknown>>();
  const normalize = (row: Record<string, unknown>) => ({ ...row,
    issueDate: typeof row.issueDate === "string" ? parseDate(row.issueDate, source) : row.issueDate,
    dueDate: typeof row.dueDate === "string" ? parseDate(row.dueDate, source) : row.dueDate });
  for (const [index, input] of raw.entries()) {
    const row = normalize(input);
    if ("lines" in row) { groups.set(`nested:${index}`, row); continue; }
    const flat = flatSchema.parse(row);
    const header = { contactId: flat.contactId, issueDate: flat.issueDate, dueDate: flat.dueDate,
      reference: flat.reference ?? null, currencyCode: flat.currencyCode };
    const key = flat.invoiceNumber ? `flat-number:${flat.invoiceNumber}`
      : `flat-header:${JSON.stringify([flat.contactId, flat.issueDate, flat.dueDate, flat.reference ?? null])}`;
    const existing = groups.get(key);
    if (existing && JSON.stringify({ ...existing, lines: undefined }) !== JSON.stringify(header))
      invoiceInputError("Grouped invoice headers must agree (contact, dates, reference and currency)");
    const price = typeof flat.lineUnitPrice === "string" ? { unitPriceExact: flat.lineUnitPrice } : { unitPrice: flat.lineUnitPrice };
    if (typeof flat.lineUnitPrice === "string" && flat.lineUnitPriceExact !== undefined) {
      const first = invoiceDecimalRatio(flat.lineUnitPrice), second = invoiceDecimalRatio(flat.lineUnitPriceExact);
      if (first.numerator * second.denominator !== second.numerator * first.denominator) invoiceInputError("CSV major price aliases disagree");
    }
    const line = { description: flat.lineDescription, quantity: flat.lineQuantity === undefined ? 1 : Number(flat.lineQuantity),
      ...price, ...(flat.lineUnitPriceExact === undefined ? {} : { unitPriceExact: flat.lineUnitPriceExact }),
      unitPriceMinor: flat.lineUnitPriceMinor, accountId: flat.lineAccountId, taxRateId: flat.lineTaxRateId };
    if (existing) (existing.lines as unknown[]).push(line);
    else groups.set(key, { ...header, lines: [line] });
  }
  return [...groups.values()];
}

export function invoiceImportTotals(row: InvoiceImportRow, rates: Map<string, number> = new Map()) {
  // Import has always rounded the extended major price, then stored the rounded unit price.
  return invoiceWriteTotals(row.lines, row.currencyCode, false, rates);
}
export async function invoiceBulkJson(request: Request) {
  try { return await request.json(); }
  catch { invoiceInputError("Expected a valid JSON request body"); }
}
export function invoiceImportPreviewTotals(row: InvoiceImportRow, rates: Map<string, number>) {
  const { subtotal, taxTotal, total } = invoiceImportTotals(row, rates);
  return publicMoneyDto({ subtotal, taxTotal, total, currencyCode: row.currencyCode }, ["subtotal", "taxTotal", "total"]);
}

/** Preserve the English currency display without converting a decimal money value to Number. */
export function formatInvoiceReminderAmount(amount: number, currency: string) {
  if (!Number.isSafeInteger(amount) || amount < 0) invoiceInputError("Reminder amount must be nonnegative safe integer minor units");
  const { minorUnits } = currencyMetadata(currency), scale = 10n ** BigInt(minorUnits);
  const decimal = toMajorDecimal(money(BigInt(amount), currency));
  const fraction = decimal.split(".")[1];
  return new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: minorUnits, maximumFractionDigits: minorUnits })
    .formatToParts(BigInt(amount) / scale).map(part => part.type === "fraction" ? fraction : part.value).join("");
}
