import { z } from "zod";
import { exactMinorSchema, legacyMinor, legacyMinorSchema, stringifyWire, WireCompatibilityError } from "@/lib/money/wire";

export const catalogId = z.string().uuid().describe("Organization-owned inventory item, variant or supplier-link UUID");
const price = legacyMinorSchema.min(0).refine(v => !Object.is(v, -0), "Negative zero is not canonical");
const exactPrice = exactMinorSchema.refine(v => !v.startsWith("-"), "Price must be nonnegative");
export const catalogPriceFields = {
  purchasePrice: price.optional().describe("Nonnegative integer cents per unit, 0..9007199254740991; omission retains on update, defaults zero on create"),
  purchasePriceMinor: exactPrice.optional().describe("Canonical nonnegative integer cents string; agrees with purchasePrice; safe Number range only"),
  salePrice: price.optional().describe("Nonnegative integer cents per unit, 0..9007199254740991; omission retains on update, defaults zero on create"),
  salePriceMinor: exactPrice.optional().describe("Canonical nonnegative integer cents string; agrees with salePrice; safe Number range only"),
};
export const catalogQuantity = z.number().int().min(-2147483648).max(2147483647)
  .refine(v => !Object.is(v, -0), "Negative zero is not canonical")
  .describe("Signed int32 whole physical units, not money or hundredths; variant metadata only, does not post stock or ledger");
const leadDays = catalogQuantity.pipe(z.number().min(0)).describe("Nonnegative int32 lead time in days, not money");
const text = z.string().max(10000);
const variantFields = {
  name: text.min(1).describe("Variant name"),
  sku: text.nullable().optional().describe("Optional SKU; null clears on update"),
  ...catalogPriceFields,
  quantityOnHand: catalogQuantity.optional().describe("Signed int32 whole-unit variant metadata; default zero, never changes parent stock/valuation"),
  options: z.record(z.string().max(10000), text).optional().describe("Option-name to option-value map; default {}, replaces on update"),
};
export const variantCreateSchema = z.object(variantFields).strict();
export const variantUpdateSchema = z.object({ ...variantFields,
  isActive: z.boolean().optional().describe("Optional active flag; creation defaults true"),
}).partial().strict();
const supplierFields = {
  supplierCode: text.optional().describe("Optional supplier SKU; empty string clears"),
  leadTimeDays: leadDays.optional().describe("Nonnegative int32 lead time in days; default zero on create"),
  purchasePrice: catalogPriceFields.purchasePrice,
  purchasePriceMinor: catalogPriceFields.purchasePriceMinor,
  isPreferred: z.boolean().optional().describe("Preferred-source flag; default false; multiple preferred sources allowed"),
};
export const supplierCreateSchema = z.object({
  contactId: catalogId.describe("Live organization-owned contact UUID with supplier or both type"),
  ...supplierFields,
}).strict();
export const supplierUpdateSchema = z.object(supplierFields).strict();

/** Resolve both aliases before mutation; never coerce a string through Number. */
export function catalogPrices<T extends { purchasePrice?: number; purchasePriceMinor?: string; salePrice?: number; salePriceMinor?: string }>(input: T) {
  const { purchasePriceMinor, salePriceMinor, ...rest } = input;
  const result = { ...rest } as Omit<T, "purchasePriceMinor" | "salePriceMinor"> & { purchasePrice?: number; salePrice?: number };
  for (const key of ["purchasePrice", "salePrice"] as const) {
    const numeric = input[key], exact = key === "purchasePrice" ? purchasePriceMinor : salePriceMinor;
    if (numeric !== undefined) price.parse(numeric);
    if (exact !== undefined) {
      exactPrice.parse(exact);
      if (numeric !== undefined && BigInt(numeric) !== BigInt(exact))
        throw new z.ZodError([{ code: "custom", path: [key + "Minor"], message: "Price aliases disagree" }]);
      result[key] = legacyMinor(BigInt(exact));
    }
  }
  return result;
}
export function catalogDto<T extends { purchasePrice: number | null; salePrice?: number | null; quantityOnHand?: number | null; leadTimeDays?: number | null }>(row: T) {
  const aliases: { purchasePriceMinor: string | null; salePriceMinor?: string | null } = { purchasePriceMinor: null };
  try {
    if (row.purchasePrice !== null) aliases.purchasePriceMinor = String(price.parse(row.purchasePrice));
    if (row.salePrice !== undefined) aliases.salePriceMinor = row.salePrice === null ? null : String(price.parse(row.salePrice));
    if (row.quantityOnHand != null) catalogQuantity.parse(row.quantityOnHand);
    if (row.leadTimeDays != null) leadDays.parse(row.leadTimeDays);
    const result = { ...row, ...aliases }; stringifyWire(result); return result;
  } catch (error) {
    if (error instanceof WireCompatibilityError) throw error;
    throw new WireCompatibilityError("Unsupported saved inventory catalog price or physical quantity");
  }
}
export async function readCatalogJson(request: Request): Promise<unknown> {
  try { return await request.json(); } catch {
    throw new z.ZodError([{ code: "custom", path: [], message: "Invalid JSON inventory catalog body" }]);
  }
}
