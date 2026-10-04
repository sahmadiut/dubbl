import { getAuthContext } from "@/lib/api/auth-context";
import { ok, handleError } from "@/lib/api/response";
import { readCatalogJson } from "@/lib/api/inventory-catalog-wire";
import { countStockTakeLine } from "@/lib/api/inventory-movements";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; lineId: string }> }) {
  try {
    const { id, lineId } = await params;
    const ctx = await getAuthContext(request);
    return ok({ line: await countStockTakeLine(ctx, id, lineId, await readCatalogJson(request), request) });
  } catch (error) { return handleError(error); }
}
