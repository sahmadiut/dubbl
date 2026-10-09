import { z } from "zod";
import { exactMinorSchema, legacyMinor, WireCompatibilityError } from "@/lib/money/wire";
import { parseMoney } from "./transformers";
import { preProcessAccounts, preProcessContacts } from "./pre-process";
import { parseCSV } from "./csv-utils";
import { getMapping } from "./mappings";
import { openingValue } from "@/lib/api/inventory-master-wire";

export const genericSource = z.enum(["quickbooks", "xero", "freshbooks", "wave", "custom"]);
export const genericEntity = z.enum(["accounts", "contacts", "invoices", "bills", "entries", "products", "bank-transactions"]);
export const directEntity = z.enum(["accounts", "contacts", "products"]);
export const importRowsSchema = z.strictObject({
  fileName: z.string().min(1).max(255).describe("Import file name for the job record"),
  source: genericSource.default("custom").describe("Source aliases and type normalization; fixed two-decimal prices regardless of source"),
  rows: z.array(z.record(z.string(), z.unknown())).min(1).max(1000).describe("1..1000 mapped rows; product prices are decimal-major values or canonical Minor strings"),
});
export const previewRowsSchema = importRowsSchema.omit({ fileName: true });
export const csvImportSchema = z.strictObject({
  entityType: directEntity.describe("Accounts, contacts or products; use domain tools for financial documents and bank statements"),
  csvContent: z.string().min(1).max(5000000).describe("CSV text with headers; max 5 MB UTF-8 and 1000 rows, including quoted commas and newlines"),
  source: genericSource.default("custom").describe("Source alias mapping and type normalization; custom accepts canonical field names"),
});
export const exportFiltersSchema = z.strictObject({
  startDate: z.iso.date().optional().describe("Inclusive Gregorian YYYY-MM-DD lower bound for documents, journals and bank transactions"),
  endDate: z.iso.date().optional().describe("Inclusive Gregorian YYYY-MM-DD upper bound for documents, journals and bank transactions"),
}).refine(v => !v.startDate || !v.endDate || v.startDate <= v.endDate, "Start date must not follow end date");
export const exportToolSchema = z.strictObject({
  entityType: genericEntity.describe("Entity whose live organization-owned rows are exported"),
  dateFrom: z.iso.date().optional().describe("Inclusive Gregorian YYYY-MM-DD start; transactional entities only"),
  dateTo: z.iso.date().optional().describe("Inclusive Gregorian YYYY-MM-DD end; transactional entities only"),
});
export const importJobsSchema = z.strictObject({
  limit: z.number().int().min(1).max(100).default(20).describe("Maximum jobs, 1..100; default 20"),
  offset: z.number().int().min(0).max(1000000).default(0).describe("Jobs to skip, 0..1000000"),
});
const text = z.string().max(10000), optionalText = text.nullable().optional();
const accountRow = z.strictObject({ code: text.trim().min(1), name: text.trim().min(1),
  type: z.enum(["asset", "liability", "equity", "revenue", "expense"]), subType: optionalText, description: optionalText,
  isActive: z.union([z.boolean(), z.enum(["true", "false"]).transform(v => v === "true")]).optional(),
});
const contactRow = z.strictObject({ name: text.trim().min(1), email: optionalText, phone: optionalText,
  type: z.enum(["customer", "supplier", "both"]).default("customer"), taxNumber: optionalText,
  billingLine1: optionalText, billingCity: optionalText, billingState: optionalText, billingPostalCode: optionalText, billingCountry: optionalText,
});
const decimal = z.union([z.string().max(100), z.number().finite()]);
const quantity = z.union([z.number().int().min(0).max(2147483647), z.string().regex(/^(0|[1-9]\d*)$/)
  .refine(v => /^(0|[1-9]\d*)$/.test(v) && v.length <= 10 && BigInt(v) <= 2147483647n, "Quantity must fit nonnegative int32").transform(Number)]);
const productRow = z.strictObject({ name: text.trim().min(1), sku: optionalText, description: optionalText,
  unitPrice: decimal.optional(), costPrice: decimal.optional(),
  unitPriceMinor: exactMinorSchema.optional(), costPriceMinor: exactMinorSchema.optional(),
  quantityOnHand: quantity.optional().default(0),
  // Source product types are metadata unsupported by the inventory schema.
  type: z.literal("").optional(),
  currencyCode: z.string().regex(/^[A-Z]{3}$/).optional(),
});
function price(value: string | number | undefined, alias: string | undefined) {
  const amount = value === undefined ? undefined : parseMoney(value);
  if ((amount !== undefined && amount < 0) || alias?.startsWith("-")) {
    throw new z.ZodError([{ code: "custom", path: ["price"], message: "Product prices must be nonnegative" }]);
  }
  if (amount !== undefined && alias !== undefined && BigInt(amount) !== BigInt(alias)) {
    throw new z.ZodError([{ code: "custom", path: ["price"], message: "Decimal price and Minor alias disagree" }]);
  }
  return alias === undefined ? amount ?? 0 : legacyMinor(BigInt(alias));
}
export function parseGenericRow(entity: z.infer<typeof directEntity>, input: Record<string, unknown>, source: z.infer<typeof genericSource>) {
  if (entity === "accounts") return { entity, data: accountRow.parse(preProcessAccounts([input], source)[0]) } as const;
  if (entity === "contacts") return { entity, data: contactRow.parse(preProcessContacts([input])[0]) } as const;
  const row = productRow.parse(input);
  const salePrice = price(row.unitPrice, row.unitPriceMinor), purchasePrice = price(row.costPrice, row.costPriceMinor);
  if (row.quantityOnHand > 0 && purchasePrice === 0) {
    throw new z.ZodError([{ code: "custom", path: ["quantityOnHand"], message: "Opening stock requires a positive purchase price; use inventory workflows for other adjustments" }]);
  }
  openingValue({ code: row.sku || "generated", name: row.name, purchasePrice, salePrice, quantityOnHand: row.quantityOnHand });
  return { entity, data: { name: row.name, sku: row.sku, description: row.description, salePrice, purchasePrice, quantityOnHand: row.quantityOnHand, currencyCode: row.currencyCode } } as const;
}
export function previewGenericRows(entity: z.infer<typeof directEntity>, input: unknown) {
  const parsed = previewRowsSchema.parse(input);
  const preview = parsed.rows.map((data, i) => {
    try { parseGenericRow(entity, data, parsed.source); return { row: i + 1, data, valid: true, errors: [] as string[] }; }
    catch (error) {
      if (error instanceof WireCompatibilityError) throw error;
      return { row: i + 1, data, valid: false, errors: [error instanceof Error ? error.message : "Invalid row"] };
    }
  });
  return { preview, validCount: preview.filter(v => v.valid).length, totalCount: preview.length };
}
export function mappedCsvRows(entity: z.infer<typeof directEntity>, source: z.infer<typeof genericSource>, csv: string) {
  const { headers, rows } = parseCSV(csv), aliases = getMapping(source, entity);
  const lookup = new Map(aliases.flatMap(a => a.aliases.map(v => [v.toLowerCase(), a.targetField] as const)));
  const mapped = headers.map(h => lookup.get(h.toLowerCase()) ?? h);
  if (new Set(mapped).size !== mapped.length) throw new z.ZodError([{ code: "custom", path: ["csv"], message: "Multiple headers map to the same field" }]);
  return rows.map(row => Object.fromEntries(headers.map((h, i) => [mapped[i], row[h]])));
}
