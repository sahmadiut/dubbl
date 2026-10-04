import { getAuthContext } from "@/lib/api/auth-context";
import { handleError, ok, created } from "@/lib/api/response";
import { readCatalogJson } from "@/lib/api/inventory-catalog-wire";
import { listInventoryItems, createInventoryItem } from "@/lib/api/inventory-master";
export async function GET(request: Request) {
  try {
    const ctx = await getAuthContext(request), params = new URL(request.url).searchParams;
    const input = Object.fromEntries(params);
    const query = { ...input, ...(input.page !== undefined ? { page: Number(input.page) } : {}), ...(input.limit !== undefined ? { limit: Number(input.limit) } : {}) };
    return ok(await listInventoryItems(ctx, query));
  } catch (error) { return handleError(error); }
}
export async function POST(request: Request) {
  try { const ctx = await getAuthContext(request); return created({ inventoryItem: await createInventoryItem(ctx, await readCatalogJson(request), request) }); }
  catch (error) { return handleError(error); }
}
