import { z } from "zod";
import { exactMinorSchema, legacyMinor, legacyMinorSchema, WireCompatibilityError } from "@/lib/money/wire";
import { catalogId, catalogQuantity } from "./inventory-catalog-wire";
import { publicMoneyDto } from "./public-money-wire";
import { invoiceInputError } from "./invoice-write-wire";
import { roundInventoryRatio } from "@/lib/money/inventory-cost";

const money = legacyMinorSchema.min(0).refine(v => !Object.is(v, -0));
const minor = exactMinorSchema.refine(v => !v.startsWith("-"));
const text = z.string().max(10000);
const costs = {
  laborCostCents: money.optional().describe("Nonnegative safe integer base-currency minor units per finished unit; defaults zero"),
  laborCostCentsMinor: minor.optional().describe("Canonical nonnegative minor-unit string; agrees with laborCostCents; safe Number range"),
  overheadCostCents: money.optional().describe("Nonnegative safe integer base-currency minor units per finished unit; defaults zero"),
  overheadCostCentsMinor: minor.optional().describe("Canonical nonnegative minor-unit string; agrees with overheadCostCents; safe Number range"),
};
export const bomCreateSchema = z.object({
  assemblyItemId: catalogId.describe("Live active owned finished inventory item UUID"),
  name: text.min(1).describe("Recipe name"),
  description: text.nullable().optional().describe("Description; null clears"),
  ...costs,
}).strict();
export const bomUpdateSchema = bomCreateSchema.omit({ assemblyItemId: true }).partial().extend({
  isActive: z.boolean().optional().describe("Whether recipe is available for new orders and builds"),
});
export const assemblyQuantity = catalogQuantity.pipe(z.number().positive()).describe("Positive int32 whole finished units, never quantity hundredths");
export const assemblyCreateSchema = z.object({
  bomId: catalogId.describe("Live active owned recipe UUID"),
  quantity: assemblyQuantity,
  notes: text.nullable().optional().describe("Order notes; null clears"),
}).strict();
export const assemblyUpdateSchema = assemblyCreateSchema.omit({ bomId: true }).partial().extend({
  status: z.enum(["draft", "in_progress", "cancelled"]).optional().describe("Draft/in_progress/cancelled; completion only through build_assembly"),
});
export const assemblyDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => {
  const d = new Date(v + "T00:00:00Z"); return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === v;
}, "Valid Gregorian date required").describe("Gregorian posting date YYYY-MM-DD; subject to period locks");
export const assemblyBuildSchema = z.object({ date: assemblyDate.optional().describe("Posting date YYYY-MM-DD; defaults to UTC today") }).strict();
export async function readAssemblyBuild(request: Request): Promise<unknown> {
  const body = await request.text();
  if (!body.trim()) return {};
  try { return JSON.parse(body); } catch { throw new z.ZodError([{ code: "custom", path: [], message: "Invalid assembly JSON" }]); }
}

// Recipe decimals are exact physical units/percent, separate from ledger money.
export function recipeRatio(value: string) {
  const [whole, fraction = ""] = value.split(".");
  return { n: BigInt(whole + fraction), d: 10n ** BigInt(fraction.length) };
}
function decimal(max: bigint, positive: boolean) {
  return z.string().max(17).regex(/^(?:0|[1-9]\d{0,9})(?:\.\d{1,6})?$/).refine(v => {
    if (!/^(?:0|[1-9]\d{0,9})(?:\.\d{1,6})?$/.test(v)) return false;
    const r = recipeRatio(v); return (positive ? r.n > 0n : r.n >= 0n) && r.n <= max * r.d;
  }, "Recipe decimal outside supported range");
}
const quantityDecimal = decimal(2147483647n, true);
const percentDecimal = decimal(100n, false);
const decimalInput = (schema: typeof quantityDecimal) => z.union([schema, z.number().finite().refine(v => !Object.is(v, -0)).transform(String).pipe(schema)]);
export const componentCreateSchema = z.object({
  componentItemId: catalogId.describe("Live active owned component inventory UUID; cannot equal finished item"),
  quantity: decimalInput(quantityDecimal).optional().describe("Physical units per finished unit; decimal string or number, up to six decimal places, >0..2147483647"),
  quantityExact: quantityDecimal.optional().describe("Exact physical decimal string; agrees with quantity; required if quantity omitted"),
  wastagePercent: decimalInput(percentDecimal).optional().describe("Wastage percent 0..100, up to six decimals; default zero"),
  wastagePercentExact: percentDecimal.optional().describe("Exact percent decimal string; agrees with wastagePercent"),
}).strict();
export const componentUpdateSchema = componentCreateSchema.partial();
export function componentValues(p: z.infer<typeof componentCreateSchema>) {
  const resolve = (a: string | undefined, b: string | undefined, fallback?: string) => {
    if (a !== undefined && b !== undefined) {
      const x = recipeRatio(a), y = recipeRatio(b);
      if (x.n * y.d !== y.n * x.d) invoiceInputError("Recipe decimal aliases disagree");
    }
    const value = b ?? a ?? fallback;
    if (value === undefined) invoiceInputError("Component quantity or quantityExact required");
    return value;
  };
  return { componentItemId: p.componentItemId, quantity: resolve(p.quantity, p.quantityExact), wastagePercent: resolve(p.wastagePercent, p.wastagePercentExact, "0") };
}
export function bomCosts(p: z.infer<typeof bomUpdateSchema>) {
  const { laborCostCentsMinor, overheadCostCentsMinor, ...result } = p;
  for (const [key, alias] of [["laborCostCents", laborCostCentsMinor], ["overheadCostCents", overheadCostCentsMinor]] as const) {
    if (alias !== undefined) {
      if (result[key] !== undefined && BigInt(result[key]!) !== BigInt(alias)) invoiceInputError("BOM money aliases disagree");
      result[key] = legacyMinor(BigInt(alias));
    }
  }
  return result;
}
export function requiredComponentUnits(quantity: string, wastage: string, buildQuantity: number) {
  quantityDecimal.parse(quantity); percentDecimal.parse(wastage); assemblyQuantity.parse(buildQuantity);
  const q = recipeRatio(quantity), w = recipeRatio(wastage);
  const n = q.n * BigInt(buildQuantity) * (100n * w.d + w.n), d = q.d * 100n * w.d;
  return assemblyQuantity.parse(legacyMinor((n + d - 1n) / d));
}
export function bomDto<T extends { laborCostCents: number; overheadCostCents: number }>(row: T) {
  for (const v of [row.laborCostCents, row.overheadCostCents]) if (!money.safeParse(v).success) throw new WireCompatibilityError("Unsupported saved BOM cost");
  return publicMoneyDto(row, ["laborCostCents", "overheadCostCents"]);
}
export function recipeComponentDto<T extends { quantity: string; wastagePercent: string | null }>(row: T) {
  if (!quantityDecimal.safeParse(row.quantity).success || !percentDecimal.safeParse(row.wastagePercent ?? "0").success)
    throw new WireCompatibilityError("Unsupported saved recipe decimal");
  return { ...row, quantityExact: row.quantity, wastagePercentExact: row.wastagePercent ?? "0" };
}
export function bomEstimate(components: { quantity: string; wastagePercent: string | null; componentItem: { purchasePrice: number } }[], labor: number, overhead: number) {
  let n = 0n, d = 1n;
  for (const c of components) {
    recipeComponentDto(c); const q = recipeRatio(c.quantity), w = recipeRatio(c.wastagePercent ?? "0");
    const cn = q.n * (100n * w.d + w.n) * BigInt(money.parse(c.componentItem.purchasePrice)), cd = q.d * 100n * w.d;
    // Denominators are powers of ten: retaining the largest avoids denominator growth.
    const common = d > cd ? d : cd;
    n = n * (common / d) + cn * (common / cd); d = common;
  }
  const componentCost = roundInventoryRatio(n, d);
  return publicMoneyDto({ componentCost, laborCost: money.parse(labor), overheadCost: money.parse(overhead),
    totalCost: legacyMinor(BigInt(componentCost) + BigInt(labor) + BigInt(overhead)) }, ["componentCost", "laborCost", "overheadCost", "totalCost"]);
}
