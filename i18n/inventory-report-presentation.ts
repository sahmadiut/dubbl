import { inventoryUiValuation } from "@/lib/money/inventory-ui";

type Row = Record<string, unknown>;
const invalid = () => new Error("Invalid inventory report response");
function object(value: unknown): Row {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw invalid();
  return value as Row;
}
const text = (value: unknown): value is string => typeof value === "string";
const nullableText = (value: unknown) => value === null || text(value);
function identity(row: Row) {
  if (![row.id, row.code, row.name].every(text)) throw invalid();
}
async function json(response: Response) {
  if (!response.ok) throw invalid();
  const body = object(await response.json());
  if ("error" in body) throw invalid();
  return body;
}
export interface ValuationItem {
  id: string; code: string; name: string; category: string | null;
  quantityOnHand: number; currencyCode: string;
  unitCost: number; unitCostMinor: string;
  salePrice: number; salePriceMinor: string;
  totalCost: number; totalCostMinor: string;
  totalValue: number; totalValueMinor: string;
  marginPercent: number; margin: number; marginMinor: string;
  averageCost: number; averageCostMinor: string;
  carryingValue: number; carryingValueMinor: string;
}
export interface ValuationSummary {
  totalItems: number; currencyCode: string;
  totalCost: number; totalCostMinor: string;
  totalValue: number; totalValueMinor: string;
  totalMargin: number; carryingValue: number; carryingValueMinor: string;
}
export async function inventoryValuationJson(response: Response) {
  const body = await json(response);
  if (!Array.isArray(body.items)) throw invalid();
  for (const value of body.items) {
    const row = object(value); identity(row);
    if (!nullableText(row.category)) throw invalid();
  }
  inventoryUiValuation({ items: body.items, summary: body.summary });
  return body as unknown as { items: ValuationItem[]; summary: ValuationSummary };
}
export interface ReorderItem {
  id: string; code: string; name: string; sku: string | null;
  quantityOnHand: number; reorderPoint: number; suggestedReorderQuantity: number;
  preferredSupplier: { contactId: string; contactName: string } | null;
}
export async function inventoryAlertsJson(response: Response): Promise<ReorderItem[]> {
  const body = await json(response);
  if (!Array.isArray(body.data)) throw invalid();
  return body.data.map(value => {
    const row = object(value); identity(row);
    // Saved stock/reorder points are int32; the derived suggestion can exceed int32.
    const quantity = row.quantityOnHand, point = row.reorderPoint, suggestion = row.suggestedReorderQuantity;
    if (!nullableText(row.sku) || typeof quantity !== "number" || !Number.isInteger(quantity) || Object.is(quantity, -0) ||
        quantity < -2147483648 || quantity > 2147483647 || typeof point !== "number" || !Number.isInteger(point) ||
        Object.is(point, -0) || point < 0 || point > 2147483647 || quantity > point ||
        typeof suggestion !== "number" || !Number.isSafeInteger(suggestion) || Object.is(suggestion, -0) ||
        suggestion !== point * 2 - quantity || !Array.isArray(row.suppliers)) throw invalid();
    let preferredSupplier: ReorderItem["preferredSupplier"] = null;
    for (const value of row.suppliers) {
      const supplier = object(value);
      if (!text(supplier.contactId) || !text(supplier.contactName) || typeof supplier.isPreferred !== "boolean") throw invalid();
      if (supplier.isPreferred && !preferredSupplier) preferredSupplier = { contactId: supplier.contactId, contactName: supplier.contactName };
    }
    return { id: row.id as string, code: row.code as string, name: row.name as string, sku: row.sku as string | null,
      quantityOnHand: quantity, reorderPoint: point, suggestedReorderQuantity: suggestion, preferredSupplier };
  });
}
