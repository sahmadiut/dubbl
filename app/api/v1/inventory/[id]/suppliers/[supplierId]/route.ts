import { getAuthContext } from "@/lib/api/auth-context";
import { handleError, ok } from "@/lib/api/response";
import { readCatalogJson } from "@/lib/api/inventory-catalog-wire";
import { updateInventorySupplier, deleteInventorySupplier } from "@/lib/api/inventory-catalog";
type Params = { params: Promise<{ id: string; supplierId: string }> };
export async function PATCH(request: Request, { params }: Params) {
  try { const ctx = await getAuthContext(request), { id, supplierId } = await params;
    return ok({ inventoryItemSupplier: await updateInventorySupplier(ctx, id, supplierId, await readCatalogJson(request), request) });
  } catch (error) { return handleError(error); }
}
export async function DELETE(request: Request, { params }: Params) {
  try { const ctx = await getAuthContext(request), { id, supplierId } = await params;
    return ok(await deleteInventorySupplier(ctx, id, supplierId, request));
  } catch (error) { return handleError(error); }
}
