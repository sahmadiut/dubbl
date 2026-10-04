import { getAuthContext } from "@/lib/api/auth-context";
import { ok, handleError } from "@/lib/api/response";
import { readCatalogJson } from "@/lib/api/inventory-catalog-wire";
import { getTransfer, updateInventoryTransfer } from "@/lib/api/inventory-movements";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await getAuthContext(request);
    return ok({ transfer: await getTransfer(ctx, id) });
  } catch (error) { return handleError(error); }
}
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await getAuthContext(request);
    return ok({ transfer: await updateInventoryTransfer(ctx, id, await readCatalogJson(request), request) });
  } catch (error) { return handleError(error); }
}
