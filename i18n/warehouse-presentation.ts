// Validate only presentation fields. IDs, nullable historical flags and caller
// location text retain their stored meaning; no stock or money conversion.
export interface WarehouseView {
  id: string;
  name: string;
  code: string;
  address: string | null;
  isDefault: boolean | null;
  isActive: boolean | null;
}

function isWarehouse(value: unknown): value is WarehouseView {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return [row.id, row.name, row.code].every(v => typeof v === "string") &&
    (row.address === null || typeof row.address === "string") &&
    [row.isDefault, row.isActive].every(v => v === null || typeof v === "boolean");
}

export function warehouseJson(response: Response, kind: "list"): Promise<{ data: WarehouseView[] }>;
export function warehouseJson(response: Response, kind: "warehouse"): Promise<{ warehouse: WarehouseView }>;
export function warehouseJson(response: Response, kind: "delete"): Promise<{ success: true }>;
export async function warehouseJson(response: Response, kind: "list" | "warehouse" | "delete") {
  if (!response.ok) throw new Error("Warehouse request failed");
  const data = await response.json();
  const valid = data && typeof data === "object" && (kind === "list"
    ? Array.isArray(data.data) && data.data.every(isWarehouse)
    : kind === "warehouse" ? isWarehouse(data.warehouse) : data.success === true);
  if (!valid) throw new Error("Invalid warehouse response");
  return data;
}
