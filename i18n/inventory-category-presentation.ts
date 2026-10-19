// Presentation validation only. Canonical category IDs, parent links and caller
// text pass through unchanged; server prose never becomes a translated message.
export interface InventoryCategoryView {
  id: string;
  name: string;
  color: string | null;
  description: string | null;
  parentId: string | null;
  children?: InventoryCategoryView[];
}

function isCategory(value: unknown): value is InventoryCategoryView {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return typeof row.id === "string" && typeof row.name === "string" &&
    [row.color, row.description, row.parentId].every(v => v === null || typeof v === "string") &&
    (row.children === undefined || Array.isArray(row.children) && row.children.every(isCategory));
}

export function categoryJson(response: Response, kind: "list"): Promise<{ data: InventoryCategoryView[]; flat: InventoryCategoryView[] }>;
export function categoryJson(response: Response, kind: "category"): Promise<{ category: InventoryCategoryView }>;
export function categoryJson(response: Response, kind: "delete"): Promise<{ success: true }>;
export async function categoryJson(response: Response, kind: "list" | "category" | "delete") {
  if (!response.ok) throw new Error("Category request failed");
  const data = await response.json();
  const valid = data && typeof data === "object" && (kind === "list"
    ? Array.isArray(data.data) && data.data.every(isCategory) && Array.isArray(data.flat) && data.flat.every(isCategory)
    : kind === "category" ? isCategory(data.category) : data.success === true);
  if (!valid) throw new Error("Invalid category response");
  return data;
}
