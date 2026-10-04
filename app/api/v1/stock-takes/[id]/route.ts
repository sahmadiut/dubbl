import { getAuthContext } from "@/lib/api/auth-context";
import { ok, handleError } from "@/lib/api/response";
import { readCatalogJson } from "@/lib/api/inventory-catalog-wire";
import { getStockTake, updateStockTake, deleteStockTake } from "@/lib/api/inventory-movements";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await getAuthContext(request);
    return ok({ stockTake: await getStockTake(ctx, id) });
  } catch (error) { return handleError(error); }
}
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await getAuthContext(request);
    return ok({ stockTake: await updateStockTake(ctx, id, await readCatalogJson(request), request) });
  } catch (error) { return handleError(error); }
}
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await getAuthContext(request);
    return ok(await deleteStockTake(ctx, id, request));
  } catch (error) { return handleError(error); }
}
