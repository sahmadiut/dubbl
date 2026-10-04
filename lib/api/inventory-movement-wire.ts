import { z } from "zod";
import { catalogId, catalogQuantity } from "./inventory-catalog-wire";
import { exactMinorSchema, legacyMinor, legacyMinorSchema, stringifyWire, WireCompatibilityError } from "@/lib/money/wire";

const text = z.string().max(10000);
const ref = catalogId.nullable().optional();
export const physicalQuantity = catalogQuantity.describe("Signed int32 whole physical units; never money or scaled hundredths");
export const postingDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => {
  const d = new Date(`${v}T00:00:00Z`); return !v.startsWith("0000-") && Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === v;
}, "Invalid Gregorian date").describe("Canonical Gregorian posting date YYYY-MM-DD; defaults to UTC today");
const reason = text.min(1).describe("Reason recorded on movement and audit");
const moneyFields = (key: string) => ({
  [key]: legacyMinorSchema.optional().describe(`Optional integer cents ${key}; safe Number range`),
  [key + "Minor"]: exactMinorSchema.optional().describe(`Canonical integer cents string agreeing with ${key}; safe Number coexistence`),
});
export const adjustmentSchema = z.object({
  adjustmentType: z.enum(["quantity", "write_down", "revaluation"]).default("quantity").describe("Quantity delta, positive value reduction, or absolute new carrying value"),
  adjustment: physicalQuantity.optional().describe("Required nonzero signed whole-unit delta for quantity"),
  ...moneyFields("valueDelta"), ...moneyFields("newTotalValue"), reason,
}).strict();
export const mcpAdjustmentSchema = z.object({
  inventoryItemId: catalogId.describe("Live owned item UUID"),
  kind: z.enum(["quantity", "write_down", "revaluation"]).describe("Quantity delta, positive write-down magnitude or signed revaluation delta"),
  quantityDelta: physicalQuantity.optional().describe("Nonzero whole-unit delta for quantity only"),
  ...moneyFields("amount"), reason, date: postingDate.optional().describe("Gregorian posting date; defaults to UTC today"),
}).strict();
export function minorAlias(input: Record<string, unknown>, key: string): number {
  const numeric = input[key], exact = input[key + "Minor"];
  if (numeric === undefined && exact === undefined) throw new z.ZodError([{ code: "custom", path: [key], message: `${key} or ${key}Minor required` }]);
  if (numeric !== undefined) legacyMinorSchema.refine(v => !Object.is(v, -0)).parse(numeric);
  if (exact !== undefined) exactMinorSchema.parse(exact);
  if (numeric !== undefined && exact !== undefined && BigInt(numeric as number) !== BigInt(exact as string))
    throw new z.ZodError([{ code: "custom", path: [key], message: "Money aliases disagree" }]);
  return legacyMinor(exact === undefined ? BigInt(numeric as number) : BigInt(exact as string));
}
export function validateAdjustment(input: Record<string, unknown>, kind: string, quantityKey: string, amountKey: string) {
  if (kind === "quantity") {
    if (!input[quantityKey]) throw new z.ZodError([{ code: "custom", path: [quantityKey], message: "Nonzero quantity delta required" }]);
    if (["amount", "amountMinor", "valueDelta", "valueDeltaMinor", "newTotalValue", "newTotalValueMinor"].some(k => input[k] !== undefined))
      throw new z.ZodError([{ code: "custom", path: [], message: "Money fields do not apply to quantity adjustments" }]);
    return input[quantityKey] as number;
  }
  if (input[quantityKey] !== undefined || ["valueDelta", "newTotalValue"].filter(k => k !== amountKey).some(k => input[k] !== undefined || input[k + "Minor"] !== undefined))
    throw new z.ZodError([{ code: "custom", path: [], message: "Fields do not apply to this adjustment type" }]);
  const value = minorAlias(input, amountKey);
  if ((kind === "write_down" && value <= 0) || (amountKey === "newTotalValue" && value < 0) || (amountKey === "amount" && value === 0))
    throw new z.ZodError([{ code: "custom", path: [amountKey], message: "Invalid adjustment amount" }]);
  return value;
}
export const bulkAdjustmentSchema = z.object({ adjustments: z.array(z.object({
  itemId: catalogId.describe("Live owned item UUID"),
  quantity: physicalQuantity.refine(v => v !== 0).describe("Nonzero signed whole-unit delta"),
  reason: text.optional().describe("Optional reason; defaults to Bulk adjustment"),
}).strict()).min(1).max(100).refine(v => new Set(v.map(x => x.itemId)).size === v.length, "Duplicate items prohibited").describe("1..100 distinct item adjustments, committed atomically") }).strict();
export const warehouseCreateSchema = z.object({ name: text.min(1).describe("Warehouse name"), code: text.min(1).describe("Organization-unique code including deleted history"),
  address: text.nullable().optional().describe("Physical address; null clears"), isDefault: z.boolean().optional().describe("Default location flag"),
}).strict();
export const warehouseUpdateSchema = warehouseCreateSchema.extend({ isActive: z.boolean().optional().describe("Active location flag") }).partial();
export const transferCreateSchema = z.object({
  fromWarehouseId: catalogId.describe("Live active owned source warehouse UUID"), toWarehouseId: catalogId.describe("Live active owned destination warehouse UUID"),
  notes: text.nullable().optional().describe("Optional transfer note"),
  lines: z.array(z.object({ inventoryItemId: catalogId.describe("Live owned item UUID"), quantity: physicalQuantity.pipe(z.number().positive()).describe("Positive int32 whole units") }).strict())
    .min(1).max(100).refine(v => new Set(v.map(x => x.inventoryItemId)).size === v.length, "Duplicate items prohibited").describe("1..100 distinct item lines"),
}).strict().refine(v => v.fromWarehouseId !== v.toWarehouseId, "Source and destination must differ");
export const transferUpdateSchema = z.object({ status: z.enum(["draft", "in_transit", "cancelled"]).optional().describe("Open transfer status; terminal transfers cannot reopen"), notes: text.nullable().optional().describe("Transfer note; null clears") }).strict();
export const stockTakeCreateSchema = z.object({ name: text.min(1).describe("Stock take name"), warehouseId: ref.describe("Live active owned warehouse UUID; null means global count"), notes: text.optional().describe("Stock take note") }).strict();
export const stockTakeUpdateSchema = z.object({ name: text.min(1).optional().describe("Stock take name"), notes: text.optional().describe("Stock take note"),
  status: z.enum(["draft", "in_progress", "cancelled"]).optional().describe("Open count status; complete through apply only; terminal takes cannot reopen") }).strict();
export const stockTakeCountSchema = z.object({ countedQuantity: physicalQuantity.pipe(z.number().min(0)).describe("Nonnegative int32 counted whole units") }).strict();
export const serialCreateSchema = z.object({ serialNumbers: z.array(text.min(1)).min(1).max(1000).refine(v => new Set(v).size === v.length, "Duplicate serials prohibited").describe("1..1000 distinct serial labels; allocation metadata, does not receive stock"), warehouseId: ref.describe("Live active owned warehouse UUID; null means unassigned") }).strict();
export const lotCreateSchema = z.object({ lotNumber: text.nullable().optional().describe("Lot label"), batchNumber: text.nullable().optional().describe("Batch label"),
  quantity: physicalQuantity.pipe(z.number().positive()).describe("Positive whole-unit allocation metadata; does not receive stock"), warehouseId: ref.describe("Live active owned warehouse UUID; null means unassigned"),
  manufacturingDate: postingDate.nullable().optional().describe("Gregorian manufacturing date; null omits"), expiryDate: postingDate.nullable().optional().describe("Gregorian expiry date; null omits"),
}).strict().refine(v => !v.manufacturingDate || !v.expiryDate || v.manufacturingDate <= v.expiryDate, "Expiry precedes manufacturing date");
export const movementListSchema = z.object({ inventoryItemId: catalogId.optional().describe("Optional live owned item filter"), warehouseId: catalogId.optional().describe("Optional live owned warehouse filter"),
  type: z.enum(["adjustment", "transfer_in", "transfer_out", "stock_take", "purchase", "sale", "initial"]).optional().describe("Movement type filter"),
  page: z.number().int().min(1).max(1000000).default(1).describe("One-based page, max 1000000"), limit: z.number().int().min(1).max(200).default(50).describe("Page size, max 200"),
}).strict();
export const allocationListSchema = movementListSchema.pick({ page: true, limit: true }).extend({ status: z.enum(["available", "sold", "reserved", "damaged"]).optional().describe("Serial status filter; not applicable to lots") });
export const chartSchema = z.object({ period: z.enum(["30d", "90d", "12m"]).default("30d").describe("Daily/weekly/monthly physical-unit chart window"), warehouseId: catalogId.optional().describe("Optional live owned warehouse filter") }).strict();
export function movementDto<T extends { unitCost: number; value: number; quantity: number; previousQuantity: number; newQuantity: number }>(row: T) {
  try {
    legacyMinorSchema.min(0).parse(row.unitCost); legacyMinorSchema.parse(row.value);
    for (const k of ["quantity", "previousQuantity", "newQuantity"] as const) physicalQuantity.parse(row[k]);
    const result = { ...row, unitCostMinor: String(row.unitCost), valueMinor: String(row.value) }; stringifyWire(result); return result;
  } catch { throw new WireCompatibilityError("Unsupported saved movement money or physical quantity"); }
}
export function stockTakeLineDto<T extends { expectedQuantity: number; countedQuantity: number | null; discrepancy: number | null; valueAdjustment: number | null }>(row: T) {
  try {
    for (const k of ["expectedQuantity", "countedQuantity", "discrepancy"] as const) if (row[k] !== null) physicalQuantity.parse(row[k]);
    if (row.valueAdjustment !== null) legacyMinorSchema.parse(row.valueAdjustment);
    return { ...row, valueAdjustmentMinor: row.valueAdjustment === null ? null : String(row.valueAdjustment) };
  } catch { throw new WireCompatibilityError("Unsupported saved stock-take line"); }
}
export function queryInput(request: Request, numeric: string[] = []) {
  const result: Record<string, unknown> = {};
  for (const [key, value] of new URL(request.url).searchParams) result[key] = numeric.includes(key) && /^\d+$/.test(value) ? Number(value) : value;
  return result;
}
