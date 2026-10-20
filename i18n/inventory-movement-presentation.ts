import { inventoryUiItem, inventoryUiStockTakeLine } from "@/lib/money/inventory-ui";

type Row = Record<string, unknown>;
const invalid = () => new Error("Invalid inventory movement response");
function object(value: unknown): Row {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw invalid();
  return value as Row;
}
const text = (value: unknown): value is string => typeof value === "string";
const nullableText = (value: unknown) => value === null || text(value);
function whole(value: unknown, min = 0): number {
  if (typeof value !== "number" || !Number.isInteger(value) || Object.is(value, -0) || value < min || value > 2147483647) throw invalid();
  return value;
}
function location(value: unknown) {
  const row = object(value);
  if (![row.id, row.name, row.code].every(text)) throw invalid();
}
export interface MovementStockSummary {
  id: string; name: string; status: "draft" | "in_progress" | "completed" | "cancelled";
  createdAt: string; itemCount: number;
}
function stockHeader(value: unknown) {
  const row = object(value);
  if (![row.id, row.name, row.createdAt].every(text) || !["draft", "in_progress", "completed", "cancelled"].includes(row.status as string)) throw invalid();
  return row;
}
export interface MovementStockLine {
  id: string; inventoryItem: { id: string; name: string; code: string };
  expectedQuantity: number; countedQuantity: number | null; discrepancy: number | null; adjusted: boolean | null;
}
export interface MovementStockDetail extends Omit<MovementStockSummary, "itemCount"> {
  notes: string | null; updatedAt: string; completedAt: string | null;
  warehouse?: { id: string; name: string; code: string } | null;
  lines: MovementStockLine[];
}
export function movementStockLine(value: unknown) {
  const row = object(value);
  inventoryUiStockTakeLine(row);
  if (!text(row.id) || (row.adjusted !== null && typeof row.adjusted !== "boolean")) throw invalid();
  return row;
}
export function movementStockDetail(value: unknown): MovementStockDetail {
  const row = stockHeader(value);
  if (!nullableText(row.notes) || !text(row.updatedAt) || !nullableText(row.completedAt) || !Array.isArray(row.lines)) throw invalid();
  if (row.warehouse != null) location(row.warehouse);
  row.lines.forEach(value => { const line = movementStockLine(value); location(line.inventoryItem); });
  return row as unknown as MovementStockDetail;
}
export interface MovementTransfer {
  id: string; fromWarehouse: { id: string; name: string; code: string }; toWarehouse: { id: string; name: string; code: string };
  status: "draft" | "in_transit" | "completed" | "cancelled"; notes: string | null;
  lines: { id: string; inventoryItemId: string; quantity: number; receivedQuantity: number | null }[];
  createdAt: string; completedAt: string | null;
}
export function movementTransfer(value: unknown): MovementTransfer {
  const row = object(value);
  if (![row.id, row.createdAt].every(text) || !nullableText(row.completedAt) || !nullableText(row.notes) ||
      !["draft", "in_transit", "completed", "cancelled"].includes(row.status as string) || !Array.isArray(row.lines)) throw invalid();
  location(row.fromWarehouse); location(row.toWarehouse);
  row.lines.forEach(value => {
    const line = object(value);
    if (![line.id, line.inventoryItemId].every(text)) throw invalid();
    whole(line.quantity, 1);
    if (line.receivedQuantity !== null) whole(line.receivedQuantity);
  });
  return row as unknown as MovementTransfer;
}
export async function movementJson(response: Response) {
  if (!response.ok) throw invalid();
  return object(await response.json());
}
export async function movementStockListJson(response: Response): Promise<MovementStockSummary[]> {
  const body = await movementJson(response);
  if (!Array.isArray(body.stockTakes)) throw invalid();
  body.stockTakes.forEach(value => { const row = stockHeader(value); whole(row.itemCount); });
  return body.stockTakes as MovementStockSummary[];
}
export async function movementTransfersJson(response: Response) {
  const body = await movementJson(response);
  if (!Array.isArray(body.data)) throw invalid();
  return body.data.map(movementTransfer);
}
export async function movementItemsJson(response: Response): Promise<{ id: string; name: string; code: string; quantityOnHand: number }[]> {
  const body = await movementJson(response);
  if (!Array.isArray(body.data)) throw invalid();
  body.data.forEach(value => { location(value); inventoryUiItem(value); });
  return body.data;
}
export async function movementStockJson(response: Response) {
  return movementStockDetail((await movementJson(response)).stockTake);
}
export async function movementTransferJson(response: Response) {
  return movementTransfer((await movementJson(response)).transfer);
}
// Stock-take creation returns the header only; it does not return detail lines.
export async function movementStockCreatedJson(response: Response) {
  stockHeader((await movementJson(response)).stockTake);
}
export async function movementAppliedJson(response: Response) {
  const body = await movementJson(response);
  const stockTake = movementStockDetail(body.stockTake);
  return { stockTake, adjustedCount: whole(body.adjustedCount) };
}
