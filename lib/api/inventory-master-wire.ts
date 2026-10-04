import { z } from "zod";
import { catalogDto, catalogPrices, catalogId, catalogPriceFields, catalogQuantity } from "./inventory-catalog-wire";
import { legacyMinor, legacyMinorSchema, stringifyWire, WireCompatibilityError } from "@/lib/money/wire";
import { catalogPriceMinor, catalogWholeInput } from "@/lib/money/catalog-input";

const text = z.string().max(10000);
const ref = catalogId.nullable().optional();
const fields = {
  code: text.min(1).describe("Item code, unique within the organization including deleted history"),
  name: text.min(1).describe("Item name"),
  description: text.nullable().optional().describe("Description; null clears"),
  category: text.nullable().optional().describe("Free-text category; null clears"),
  categoryId: ref.describe("Live organization-owned category UUID; null clears"),
  sku: text.nullable().optional().describe("SKU; null clears"),
  ...catalogPriceFields,
  costAccountId: ref.describe("Live owned expense account UUID; null clears"),
  revenueAccountId: ref.describe("Live owned revenue account UUID; null clears"),
  inventoryAccountId: ref.describe("Live owned asset account UUID; null clears"),
  reorderPoint: catalogQuantity.pipe(z.number().min(0)).optional().describe("Nonnegative int32 whole physical units; default zero"),
  isActive: z.boolean().optional().describe("Active flag; default true"),
};
export const itemCreateSchema = z.object({ ...fields,
  quantityOnHand: catalogQuantity.optional().describe("Signed int32 opening whole units; received only when quantity and purchase price are positive; otherwise starts at zero"),
}).strict();
export const itemUpdateSchema = z.object(fields).partial().strict();
export const itemListSchema = z.object({
  search: text.optional().describe("Search code, name or SKU"),
  category: text.optional().describe("Filter free-text category"),
  categoryId: catalogId.optional().describe("Filter category UUID"),
  status: z.enum(["active", "inactive", "low_stock"]).optional().describe("Filter item status"),
  sortBy: z.enum(["name", "code", "quantity", "purchasePrice", "salePrice", "createdAt", "category"]).default("createdAt").describe("Sort column"),
  sortOrder: z.enum(["asc", "desc"]).default("desc").describe("Sort direction"),
  page: z.number().int().min(1).max(1000000).default(1).describe("One-based page, max 1000000"),
  limit: z.number().int().min(1).max(200).default(50).describe("Page size, max 200"),
}).strict();
export const categoryCreateSchema = z.object({
  name: text.min(1).describe("Category name, unique within organization including deleted history"),
  color: text.nullable().optional().describe("Optional color; null clears"),
  description: text.nullable().optional().describe("Optional description; null clears"),
  parentId: ref.describe("Live owned parent category UUID; null makes a root; cycles prohibited"),
}).strict();
export const categoryUpdateSchema = categoryCreateSchema.partial();
export const bulkItemSchema = z.object({
  action: z.enum(["delete", "set_active", "set_inactive", "set_category", "adjust_stock"]).describe("REST bulk operation"),
  ids: z.array(catalogId).min(1).max(200).refine(v => new Set(v).size === v.length, "Duplicate item IDs").describe("1..200 distinct live owned item UUIDs"),
  category: text.optional().describe("Required for set_category; empty clears free-text category"),
  adjustment: catalogQuantity.optional().describe("Required nonzero signed whole-unit stock delta for adjust_stock"),
  reason: text.optional().describe("Optional stock-adjustment reason"),
}).strict().superRefine((v, ctx) => {
  if (v.action === "set_category" && v.category === undefined) ctx.addIssue({ code: "custom", path: ["category"], message: "Category required" });
  if (v.action === "adjust_stock" && !v.adjustment) ctx.addIssue({ code: "custom", path: ["adjustment"], message: "Nonzero adjustment required" });
  if (v.action !== "set_category" && v.category !== undefined) ctx.addIssue({ code: "custom", path: ["category"], message: "Category only applies to set_category" });
  if (v.action !== "adjust_stock" && (v.adjustment !== undefined || v.reason !== undefined)) ctx.addIssue({ code: "custom", path: ["adjustment"], message: "Adjustment fields only apply to adjust_stock" });
});
export const inventoryCsvSchema = z.object({ csv: z.string().min(1).max(5000000)
  .refine(v => new TextEncoder().encode(v).length <= 5000000, "Maximum CSV size is 5 MB in UTF-8")
  .describe("CSV text, max 5 MB/1000 data rows. Legacy purchasePrice/salePrice are two-decimal major units; *Minor columns are canonical integer cents. Quantity fields are whole units.") }).strict();

export function itemDto<T extends { purchasePrice: number; salePrice: number; averageCost: number; standardCost: number; totalValue: number; quantityOnHand: number; reorderPoint: number }>(row: T) {
  try {
    const prices = catalogDto(row);
    for (const key of ["averageCost", "standardCost", "totalValue"] as const) legacyMinorSchema.min(0).parse(row[key]);
    catalogQuantity.pipe(z.number().min(0)).parse(row.reorderPoint);
    const priceValue = legacyMinor(BigInt(row.quantityOnHand) * BigInt(row.purchasePrice));
    const result = { ...prices, averageCostMinor: String(row.averageCost), standardCostMinor: String(row.standardCost),
      totalValueMinor: String(row.totalValue), priceValue, priceValueMinor: String(priceValue) };
    stringifyWire(result); return result;
  } catch (error) {
    if (error instanceof WireCompatibilityError) throw error;
    throw new WireCompatibilityError("Unsupported saved inventory item money or physical quantity");
  }
}
export function openingValue(input: z.infer<typeof itemCreateSchema>) {
  const parsed = catalogPrices(input), qty = parsed.quantityOnHand ?? 0, price = parsed.purchasePrice ?? 0;
  return qty > 0 && price > 0 ? legacyMinor(BigInt(qty) * BigInt(price)) : 0;
}

// RFC-style quoted fields, including escaped quotes/newlines; no float/partial parsing.
export function parseInventoryCsv(input: string) {
  inventoryCsvSchema.parse({ csv: input });
  const records: string[][] = []; let row: string[] = [], value = "", quoted = false, closed = false;
  const fail = (message: string): never => { throw new z.ZodError([{ code: "custom", path: ["csv"], message }]); };
  const field = () => { row.push(value.trim()); value = ""; closed = false; };
  const record = () => { field(); if (row.some(v => v !== "")) records.push(row); row = []; };
  const csv = input.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  for (let i = 0; i < csv.length; i++) {
    const ch = csv[i];
    if (quoted) {
      if (ch === '"') { if (csv[i + 1] === '"') { value += '"'; i++; } else { quoted = false; closed = true; } }
      else value += ch;
    } else if (ch === ",") field();
    else if (ch === "\n") record();
    else if (ch === '"') { if (value || closed) fail("Malformed CSV quote"); quoted = true; }
    else { if (closed && ch.trim()) fail("Unexpected text after quoted field"); value += ch; }
  }
  if (quoted) fail("Unterminated CSV quote");
  if (value || row.length || closed) record();
  if (records.length < 2) fail("No data rows found in CSV");
  if (records.length > 1001) fail("Maximum 1000 CSV data rows");
  const aliases: Record<string, string> = {
    code: "code", itemcode: "code", name: "name", itemname: "name", product: "name", description: "description", desc: "description",
    category: "category", cat: "category", sku: "sku", barcode: "sku", purchaseprice: "purchasePrice", cost: "purchasePrice", costprice: "purchasePrice",
    saleprice: "salePrice", price: "salePrice", sellprice: "salePrice", purchasepriceminor: "purchasePriceMinor", salepriceminor: "salePriceMinor",
    quantityonhand: "quantityOnHand", quantity: "quantityOnHand", qty: "quantityOnHand", stock: "quantityOnHand", onhand: "quantityOnHand",
    reorderpoint: "reorderPoint", reorder: "reorderPoint", minstock: "reorderPoint", status: "isActive",
  };
  const headers = records[0].map(h => aliases[h.toLowerCase().replace(/[_\s-]/g, "")]);
  if (headers.some(h => !h) || new Set(headers).size !== headers.length || !headers.includes("code") || !headers.includes("name")) fail("Unknown, duplicate or missing required CSV columns");
  return records.slice(1).map((values, index) => {
    try {
      if (values.length !== headers.length) fail("CSV column count mismatch");
      const body: Record<string, unknown> = {};
      headers.forEach((key, i) => {
        const v = values[i];
        if (key === "purchasePrice" || key === "salePrice") { if (v) body[key] = legacyMinor(BigInt(catalogPriceMinor(v)!)); }
        else if (key === "purchasePriceMinor" || key === "salePriceMinor") { if (v) body[key] = v; }
        else if (key === "quantityOnHand" || key === "reorderPoint") { if (v) body[key] = catalogWholeInput(v, key === "quantityOnHand"); }
        else if (key === "isActive") { if (v) { if (!/^(active|inactive)$/i.test(v)) fail("CSV status must be Active or Inactive"); body[key] = v.toLowerCase() === "active"; } }
        else body[key] = v;
      });
      const parsed = itemCreateSchema.parse(body); catalogPrices(parsed); openingValue(parsed);
      return { row: index + 2, input: parsed };
    } catch (error) {
      return { row: index + 2, error: error instanceof Error ? error.message : "Invalid CSV row" };
    }
  });
}
