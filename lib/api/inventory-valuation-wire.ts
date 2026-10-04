import { z } from "zod";
import { catalogId, catalogQuantity } from "./inventory-catalog-wire";
import { legacyMinor, WireCompatibilityError } from "@/lib/money/wire";
import { inventoryLayerValue } from "@/lib/money/inventory-cost";

export const valuationReportSchema = z.object({
  sortBy: z.enum(["name", "code", "quantity", "totalCost", "totalValue", "marginPercent"]).default("name").describe("Sort report by saved or computed column"),
  sortOrder: z.enum(["asc", "desc"]).default("asc").describe("Sort direction"),
  method: z.enum(["weighted_average", "fifo"]).optional().describe("Legacy presentation selection; configured item cost method determines carrying value, never recalculates history"),
}).strict();
export const layerListSchema = z.object({
  inventoryItemId: catalogId.describe("Live owned item UUID; includes exhausted layers and consumption history"),
}).strict();
export function layerDto<T extends { remainingQuantity: number; originalQuantity: number; unitCost: number; remainingValue: number | null }>(row: T) {
  catalogQuantity.pipe(z.number().min(0)).parse(row.remainingQuantity); catalogQuantity.pipe(z.number().positive()).parse(row.originalQuantity);
  if (row.remainingQuantity > row.originalQuantity) throw new WireCompatibilityError("FIFO remaining quantity exceeds original quantity");
  const value = inventoryLayerValue(row);
  const original: Omit<T, "remainingValue"> = row;
  return { ...original, unitCostMinor: String(row.unitCost), remainingValue: value, remainingValueMinor: String(value) };
}
export function consumptionDto<T extends { quantity: number; unitCost: number; value: number | null }>(row: T) {
  catalogQuantity.pipe(z.number().positive()).parse(row.quantity);
  if (!Number.isSafeInteger(row.unitCost) || row.unitCost < 0 || (row.value !== null && (!Number.isSafeInteger(row.value) || row.value < 0))) throw new WireCompatibilityError("Invalid saved FIFO consumption");
  const value = row.value ?? legacyMinor(BigInt(row.quantity) * BigInt(row.unitCost));
  const original: Omit<T, "value"> = row;
  return { ...original, unitCostMinor: String(row.unitCost), value, valueMinor: String(value) };
}
