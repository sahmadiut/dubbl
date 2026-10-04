import { getAuthContext } from "@/lib/api/auth-context";
import { ok, handleError } from "@/lib/api/response";
import { readCatalogJson } from "@/lib/api/inventory-catalog-wire";
import { deleteAssemblyOrder, getAssemblyOrder, updateAssemblyOrder } from "@/lib/api/inventory-assembly";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await getAuthContext(request);
    return ok(await getAssemblyOrder(ctx, id));
  } catch (err) { return handleError(err); }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await getAuthContext(request);
    return ok(await updateAssemblyOrder(ctx, id, await readCatalogJson(request), request));
  } catch (err) { return handleError(err); }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await getAuthContext(request);
    return ok(await deleteAssemblyOrder(ctx, id, request));
  } catch (err) { return handleError(err); }
}
