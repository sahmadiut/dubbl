import { getAuthContext } from "@/lib/api/auth-context";
import { ok, handleError } from "@/lib/api/response";
import { queryInput } from "@/lib/api/inventory-movement-wire";
import { listMovements } from "@/lib/api/inventory-movements";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await getAuthContext(request);
    return ok(await listMovements(ctx, { ...queryInput(request, ["page", "limit"]), inventoryItemId: id }));
  } catch (error) { return handleError(error); }
}
