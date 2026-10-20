import { inventoryUiCatalog } from "@/lib/money/inventory-ui";

type Row = Record<string, unknown>;
const invalid = () => new Error("Invalid inventory catalog response");
function object(value: unknown): Row {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw invalid();
  return value as Row;
}
const text = (value: unknown): value is string => typeof value === "string";
const nullableText = (value: unknown) => value === null || text(value);
const nullableBoolean = (value: unknown) => value === null || typeof value === "boolean";

interface CatalogPrice {
  id: string; inventoryItemId: string;
  purchasePrice: number | null; purchasePriceMinor: string | null;
}
export interface PresentedInventoryVariant extends CatalogPrice {
  name: string; sku: string | null; salePrice: number | null;
  salePriceMinor: string | null; quantityOnHand: number | null;
  options: Record<string, string> | null; isActive: boolean | null;
}
export interface PresentedInventorySupplier extends CatalogPrice {
  contactId: string; contactName?: string | null; contact?: { name: string };
  supplierCode: string | null; leadTimeDays: number | null; isPreferred: boolean | null;
}

export function inventoryVariantRow(value: unknown): PresentedInventoryVariant {
  const row = object(value);
  if (![row.id, row.inventoryItemId, row.name].every(text) || !nullableText(row.sku) ||
      !nullableBoolean(row.isActive) || !("salePrice" in row) || !("quantityOnHand" in row)) throw invalid();
  if (row.options !== null && !Object.values(object(row.options)).every(text)) throw invalid();
  // Historical nullable counts/prices remain absent in the display. Validate all
  // present money/count aliases with the existing exact-money boundary.
  const { quantityOnHand, ...rest } = row;
  inventoryUiCatalog(quantityOnHand === null ? rest : row);
  return row as unknown as PresentedInventoryVariant;
}
export function inventorySupplierRow(value: unknown): PresentedInventorySupplier {
  const row = object(value);
  if (![row.id, row.inventoryItemId, row.contactId].every(text) || !nullableText(row.supplierCode) ||
      !nullableBoolean(row.isPreferred) || !("leadTimeDays" in row) ||
      (row.contactName !== undefined && !nullableText(row.contactName)) ||
      (row.contact !== undefined && !text(object(row.contact).name))) throw invalid();
  inventoryUiCatalog(row);
  return row as unknown as PresentedInventorySupplier;
}
export async function inventoryCatalogJson(response: Response) {
  if (!response.ok) throw invalid();
  return object(await response.json());
}
export async function inventoryVariantsJson(response: Response) {
  const body = await inventoryCatalogJson(response);
  if (!Array.isArray(body.data)) throw invalid();
  return body.data.map(inventoryVariantRow);
}
export async function inventorySuppliersJson(response: Response) {
  const body = await inventoryCatalogJson(response);
  if (!Array.isArray(body.data)) throw invalid();
  return body.data.map(inventorySupplierRow);
}

// Called only for local catalog-input failures, never arbitrary server prose.
export function inventoryCatalogInputError(error: unknown) {
  const keys = {
    "Enter a nonnegative price with at most two decimal places": "invalidPrice",
    "Price exceeds the supported range": "priceRange",
    "Enter a whole number": "invalidWhole",
    "Whole number is outside the supported range": "wholeRange",
  } as const;
  const message = error instanceof Error ? error.message : "";
  return Object.hasOwn(keys, message) ? keys[message as keyof typeof keys] : "invalidInput";
}
