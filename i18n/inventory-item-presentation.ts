import { inventoryUiItem, inventoryUiListSummary, inventoryUiMovement } from "@/lib/money/inventory-ui";
import type { InventoryDetailMoney } from "@/lib/money/inventory-detail-ui";

type Row = Record<string, unknown>;
const invalid = () => new Error("Invalid inventory presentation response");
function object(value: unknown): Row {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw invalid();
  return value as Row;
}
const whole = (value: unknown, minimum = 0): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= minimum;
const text = (value: unknown): value is string => typeof value === "string";
const nullableText = (value: unknown) => value === null || text(value);

export interface PresentedInventoryItem extends InventoryDetailMoney {
  id: string; code: string; name: string; description: string | null;
  category: string | null; categoryId: string | null; sku: string | null;
  imageUrl: string | null; reorderPoint: number; isActive: boolean;
}
export function inventoryItemRow(value: unknown): PresentedInventoryItem {
  const row = object(value);
  if (!["id", "code", "name"].every(key => text(row[key])) ||
      !["description", "category", "categoryId", "sku", "imageUrl"].every(key => nullableText(row[key])) ||
      typeof row.isActive !== "boolean") throw invalid();
  inventoryUiItem(row);
  return row as unknown as PresentedInventoryItem;
}

async function responseObject(response: Response) {
  if (!response.ok) throw invalid();
  return object(await response.json());
}
export async function inventoryItemJson(response: Response) {
  return inventoryItemRow((await responseObject(response)).inventoryItem);
}
export async function inventoryItemsJson(response: Response) {
  const row = await responseObject(response);
  if (!Array.isArray(row.data)) throw invalid();
  return row.data.map(inventoryItemRow);
}
export async function inventoryListJson(response: Response) {
  const row = await responseObject(response), pagination = object(row.pagination), summary = object(row.summary);
  if (!Array.isArray(row.data) || !Array.isArray(row.categories) || !row.categories.every(text) ||
      !whole(pagination.page, 1) || !whole(pagination.total) || !whole(pagination.totalPages) ||
      !whole(summary.totalItems) || !whole(summary.lowStockCount)) throw invalid();
  const data = row.data.map(inventoryItemRow);
  inventoryUiListSummary(summary);
  return { data, categories: row.categories as string[],
    pagination: pagination as { page: number; total: number; totalPages: number },
    summary: summary as { totalItems: number; totalValue: number; totalValueMinor: string; lowStockCount: number; avgMargin: number; avgMarginExact: string } };
}
export async function inventoryDeleteJson(response: Response) {
  if ((await responseObject(response)).success !== true) throw invalid();
}
export async function inventoryBulkJson(response: Response) {
  const row = await responseObject(response);
  if (row.success !== true || !whole(row.affected)) throw invalid();
  return { affected: row.affected };
}
export async function inventoryImportJson(response: Response) {
  const row = await responseObject(response);
  if (!whole(row.created) || !whole(row.updated) || !Array.isArray(row.errors)) throw invalid();
  const errors = row.errors.map(value => {
    const error = object(value);
    if (!whole(error.row, 1) || !text(error.message)) throw invalid();
    return { row: error.row, message: error.message };
  });
  return { created: row.created, updated: row.updated, errors };
}
export async function inventoryChartJson(response: Response) {
  const row = await responseObject(response);
  if (!Array.isArray(row.data)) throw invalid();
  return row.data.map(value => {
    const point = object(value);
    if (!text(point.date) || !["in", "out", "net"].every(key => whole(point[key], Number.MIN_SAFE_INTEGER))) throw invalid();
    return point as { date: string; in: number; out: number; net: number };
  });
}
export interface PresentedInventoryMovement {
  id: string; type: string; quantity: number; previousQuantity: number;
  newQuantity: number; reason: string | null; createdBy: string | null; createdAt: string;
}
export async function inventoryMovementsJson(response: Response) {
  const row = await responseObject(response);
  if (!Array.isArray(row.data)) throw invalid();
  return row.data.map(value => {
    const movement = object(value);
    if (!["id", "type", "createdAt"].every(key => text(movement[key])) ||
        !["reason", "createdBy"].every(key => nullableText(movement[key]))) throw invalid();
    inventoryUiMovement(movement);
    return movement as unknown as PresentedInventoryMovement;
  });
}
export async function inventoryWarehouseJson(response: Response) {
  const row = await responseObject(response);
  if (!Array.isArray(row.data)) throw invalid();
  return row.data.map(value => {
    const stock = object(value);
    if (!["id", "warehouseId", "warehouseName", "warehouseCode", "updatedAt"].every(key => text(stock[key])) ||
        !whole(stock.quantity, -2147483648) || stock.quantity > 2147483647) throw invalid();
    return stock as { id: string; warehouseId: string; warehouseName: string; warehouseCode: string; quantity: number; updatedAt: string };
  });
}

const movementKeys = {
  adjustment: "movementAdjustment", stock_take: "movementStockTake", purchase: "movementPurchase",
  sale: "movementSale", transfer_in: "movementTransferIn", transfer_out: "movementTransferOut",
  initial: "movementInitial", revaluation: "movementRevaluation", write_down: "movementWriteDown",
} as const;
export function inventoryMovementKey(type: string) {
  return Object.hasOwn(movementKeys, type) ? movementKeys[type as keyof typeof movementKeys] : null;
}

/** Only reviewed local parser messages are mapped; arbitrary server prose stays private. */
export function inventoryWriteDownError(error: unknown) {
  return error instanceof Error && error.message === "Write-off cannot exceed the current book value"
    ? "writeDownExceeds" : "writeDownInvalid";
}

export function inventoryPrintEscape(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
