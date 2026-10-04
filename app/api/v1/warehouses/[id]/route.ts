import { getAuthContext } from "@/lib/api/auth-context";
import { ok, handleError } from "@/lib/api/response";
import { readCatalogJson } from "@/lib/api/inventory-catalog-wire";
import { getWarehouse, writeWarehouse, deleteWarehouse } from "@/lib/api/inventory-movements";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await getAuthContext(request);
    return ok({ warehouse: await getWarehouse(ctx, id) });
  } catch (error) { return handleError(error); }
}
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await getAuthContext(request);
    return ok({ warehouse: await writeWarehouse(ctx, await readCatalogJson(request), id, request) });
  } catch (error) { return handleError(error); }
}
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await getAuthContext(request);
    return ok(await deleteWarehouse(ctx, id, request));
  } catch (error) { return handleError(error); }
}
