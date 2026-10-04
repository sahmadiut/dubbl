import { getAuthContext } from "@/lib/api/auth-context";
import { handleError, ok } from "@/lib/api/response";
import { readCatalogJson } from "@/lib/api/inventory-catalog-wire";
import { writeInventoryCategory, deleteInventoryCategory } from "@/lib/api/inventory-master";
type Params = { params: Promise<{ id: string }> };
export async function PATCH(request: Request, { params }: Params) {
  try { const ctx = await getAuthContext(request); return ok({ category: await writeInventoryCategory(ctx, await readCatalogJson(request), (await params).id, request) }); }
  catch (error) { return handleError(error); }
}
export async function DELETE(request: Request, { params }: Params) {
  try { const ctx = await getAuthContext(request); return ok(await deleteInventoryCategory(ctx, (await params).id, request)); }
  catch (error) { return handleError(error); }
}
