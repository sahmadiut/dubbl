import { getAuthContext } from "@/lib/api/auth-context";
import { handleError, ok } from "@/lib/api/response";
import { readCatalogJson } from "@/lib/api/inventory-catalog-wire";
import { getInventoryItem, updateInventoryItem, deleteInventoryItem } from "@/lib/api/inventory-master";
type Params = { params: Promise<{ id: string }> };
export async function GET(request: Request, { params }: Params) {
  try { const ctx = await getAuthContext(request); return ok({ inventoryItem: await getInventoryItem(ctx, (await params).id) }); }
  catch (error) { return handleError(error); }
}
export async function PATCH(request: Request, { params }: Params) {
  try { const ctx = await getAuthContext(request); return ok({ inventoryItem: await updateInventoryItem(ctx, (await params).id, await readCatalogJson(request), request) }); }
  catch (error) { return handleError(error); }
}
export async function DELETE(request: Request, { params }: Params) {
  try { const ctx = await getAuthContext(request); return ok(await deleteInventoryItem(ctx, (await params).id, request)); }
  catch (error) { return handleError(error); }
}
