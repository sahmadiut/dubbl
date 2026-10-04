import { getAuthContext } from "@/lib/api/auth-context";
import { handleError, ok } from "@/lib/api/response";
import { readCatalogJson } from "@/lib/api/inventory-catalog-wire";
import { updateInventoryVariant, deleteInventoryVariant } from "@/lib/api/inventory-catalog";
type Params = { params: Promise<{ id: string; variantId: string }> };
export async function PATCH(request: Request, { params }: Params) {
  try { const ctx = await getAuthContext(request), { id, variantId } = await params;
    return ok({ inventoryVariant: await updateInventoryVariant(ctx, id, variantId, await readCatalogJson(request), request) });
  } catch (error) { return handleError(error); }
}
export async function DELETE(request: Request, { params }: Params) {
  try { const ctx = await getAuthContext(request), { id, variantId } = await params;
    return ok(await deleteInventoryVariant(ctx, id, variantId, request));
  } catch (error) { return handleError(error); }
}
