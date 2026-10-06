import { z } from "zod";
import { currencyCodeSchema } from "@/lib/currency/zod";
import { rateDateSchema } from "@/lib/currency/rate-policy";
import { exactMinorSchema, legacyMinorSchema, legacyMinor, stringifyWire, WireCompatibilityError } from "@/lib/money/wire";

export const pricingId = z.string().uuid().describe("Organization-owned price-list, price-row or inventory UUID");
const quantity = z.number().int().min(1).max(2147483647);
const money = legacyMinorSchema.min(0).refine(v => !Object.is(v, -0), "Negative zero is not canonical");
const exact = exactMinorSchema.refine(v => !v.startsWith("-"), "Price must be nonnegative");
const fields = {
  name: z.string().min(1).max(10000).describe("Nonempty price-list name, unique within the organization including deleted lists"),
  currencyCode: currencyCodeSchema.optional().describe("ISO currency; defaults USD on create; changes reinterpret saved cents without FX"),
  isActive: z.boolean().optional().describe("Pricing enabled flag, default true on create"),
  effectiveFrom: rateDateSchema.nullable().optional().describe("Inclusive Gregorian YYYY-MM-DD start; null is unbounded"),
  effectiveTo: rateDateSchema.nullable().optional().describe("Inclusive Gregorian YYYY-MM-DD end; null is unbounded"),
};
export const priceListCreateSchema = z.object(fields).strict();
export const priceListUpdateSchema = z.object({ ...fields, name: fields.name.optional() }).strict();
const amounts = {
  unitPrice: money.optional().describe("Nonnegative integer cents in list currency, max 9007199254740991; this or unitPriceMinor required on add"),
  unitPriceMinor: exact.optional().describe("Canonical nonnegative cents string, same safe range; must agree with unitPrice"),
  minQuantity: quantity.optional().describe("Whole physical quantity tier, 1..2147483647; default 1 on add"),
};
export const priceItemCreateSchema = z.object({ inventoryItemId: pricingId.describe("Live active inventory item owned by this organization"), ...amounts }).strict();
export const priceItemUpdateSchema = z.object(amounts).strict();
export const priceResolveSchema = z.object({
  inventoryItemId: pricingId.describe("Live active organization inventory item to price"),
  quantity: quantity.optional().describe("Whole physical order quantity, 1..2147483647; default 1"),
  asOf: rateDateSchema.optional().describe("Gregorian YYYY-MM-DD validity date; default today's UTC date"),
}).strict();

export function pricingAmounts<T extends { unitPrice?: number; unitPriceMinor?: string }>(input: T, required = false) {
  const { unitPrice, unitPriceMinor, ...rest } = input;
  if (unitPrice !== undefined && unitPriceMinor !== undefined && String(unitPrice) !== unitPriceMinor)
    throw new z.ZodError([{ code: "custom", path: ["unitPriceMinor"], message: "Price aliases disagree" }]);
  const value = unitPriceMinor === undefined ? unitPrice : legacyMinor(BigInt(unitPriceMinor));
  if (required && value === undefined) throw new z.ZodError([{ code: "custom", path: ["unitPrice"], message: "Provide unitPrice or unitPriceMinor" }]);
  return { ...rest, ...(value === undefined ? {} : { unitPrice: value }) };
}
export function validatePriceWindow(row: { effectiveFrom: string | null; effectiveTo: string | null }) {
  if (row.effectiveFrom) rateDateSchema.parse(row.effectiveFrom);
  if (row.effectiveTo) rateDateSchema.parse(row.effectiveTo);
  if (row.effectiveFrom && row.effectiveTo && row.effectiveFrom > row.effectiveTo)
    throw new z.ZodError([{ code: "custom", path: ["effectiveTo"], message: "End date cannot precede start date" }]);
}
export function priceListDto<T extends { currencyCode: string; effectiveFrom: string | null; effectiveTo: string | null }>(row: T): T {
  try {
    if (currencyCodeSchema.parse(row.currencyCode) !== row.currencyCode) throw new Error("Noncanonical saved currency");
    validatePriceWindow(row); stringifyWire(row); return row;
  } catch { throw new WireCompatibilityError("Saved price-list currency/date metadata is unsupported"); }
}
export function priceItemDto<T extends { unitPrice: number; minQuantity: number }>(row: T) {
  try {
    money.parse(row.unitPrice); quantity.parse(row.minQuantity);
    const result = { ...row, unitPriceMinor: String(row.unitPrice) }; stringifyWire(result); return result;
  } catch { throw new WireCompatibilityError("Saved price/tier exceeds supported cents or whole-quantity range"); }
}
export async function readPricingJson(request: Request): Promise<unknown> {
  try { return await request.json(); }
  catch { throw new z.ZodError([{ code: "custom", path: [], message: "Invalid pricing JSON body" }]); }
}
