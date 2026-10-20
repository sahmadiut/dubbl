import { inventoryUiAssembly, inventoryUiBom, inventoryUiBomDetail } from "@/lib/money/inventory-ui";

type Row = Record<string, unknown>;
const invalid = () => new Error("Invalid inventory assembly response");
function object(value: unknown): Row {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw invalid();
  return value as Row;
}
const text = (value: unknown): value is string => typeof value === "string";
function item(value: unknown) {
  const row = object(value);
  if (![row.id, row.name, row.code].every(text)) throw invalid();
}
export interface AssemblyBom {
  id: string; name: string; description: string | null; isActive: boolean;
  assemblyItem: { id: string; name: string; code: string };
  currencyCode: string;
  components: { id: string; quantity: string; wastagePercent: string | null; wastagePercentExact: string;
    componentItem: { id: string; name: string; code: string; purchasePriceMinor: string } }[];
  costBreakdown: AssemblyCosts;
}
interface AssemblyCosts {
  componentCostMinor: string; laborCostMinor: string; overheadCostMinor: string; totalCostMinor: string;
}
export interface AssemblyBomDetail { bom: AssemblyBom; costBreakdown: AssemblyCosts }
export function assemblyBom(value: unknown): AssemblyBom {
  const row = object(value);
  inventoryUiBom(row);
  if (![row.id, row.name].every(text) || !(row.description === null || text(row.description)) || typeof row.isActive !== "boolean") throw invalid();
  item(row.assemblyItem);
  for (const value of row.components as unknown[]) {
    const component = object(value);
    if (!text(component.id)) throw invalid();
    item(component.componentItem);
  }
  return row as unknown as AssemblyBom;
}
export type AssemblyStatus = "draft" | "in_progress" | "completed" | "cancelled";
interface OrderHeader {
  id: string; quantity: number; status: AssemblyStatus; notes: string | null; completedAt: string | null; createdAt: string;
}
export interface AssemblyOrderView extends OrderHeader { bom: { name: string; assemblyItem: { name: string; code: string } } }
function orderHeader(value: unknown): OrderHeader {
  const row = object(value);
  if (![row.id, row.createdAt].every(text) || !(row.notes === null || text(row.notes)) ||
      !(row.completedAt === null || text(row.completedAt) && Number.isFinite(Date.parse(row.completedAt))) ||
      !["draft", "in_progress", "completed", "cancelled"].includes(row.status as string) ||
      typeof row.quantity !== "number" || !Number.isInteger(row.quantity) || row.quantity < 1 || row.quantity > 2147483647 ||
      row.status === "completed" && row.completedAt === null) throw invalid();
  return row as unknown as OrderHeader;
}
export function assemblyOrder(value: unknown): AssemblyOrderView {
  const row = object(value);
  orderHeader(row); inventoryUiAssembly(row);
  const bom = object(row.bom);
  if (!text(bom.name)) throw invalid();
  item(bom.assemblyItem);
  return row as unknown as AssemblyOrderView;
}
async function json(response: Response) {
  if (!response.ok) throw invalid();
  const body = object(await response.json());
  if (body.error) throw invalid();
  return body;
}
export async function assemblyBomsJson(response: Response) {
  const body = await json(response);
  if (!Array.isArray(body.data)) throw invalid();
  return body.data.map(assemblyBom);
}
export async function assemblyBomJson(response: Response): Promise<AssemblyBomDetail> {
  const body = await json(response);
  assemblyBom(body.bom); inventoryUiBomDetail({ bom: body.bom, costBreakdown: body.costBreakdown });
  return body as unknown as AssemblyBomDetail;
}
export async function assemblyOrdersJson(response: Response) {
  const body = await json(response);
  if (!Array.isArray(body.data)) throw invalid();
  return body.data.map(assemblyOrder);
}
// PATCH and completion return a header without nested BOM; retain the verified
// recipe already displayed instead of requiring fields the endpoint omits.
export async function assemblyUpdatedJson(response: Response, id: string, status: AssemblyStatus) {
  const order = orderHeader((await json(response)).order);
  if (order.id !== id || order.status !== status) throw invalid();
  const { quantity, notes, completedAt, createdAt } = order;
  return { id, status, quantity, notes, completedAt, createdAt };
}
export async function assemblyDeletedJson(response: Response) {
  if ((await json(response)).success !== true) throw invalid();
}
