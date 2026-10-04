import { getAuthContext } from "@/lib/api/auth-context";
import { handleError, ok, created } from "@/lib/api/response";
import { readCatalogJson } from "@/lib/api/inventory-catalog-wire";
import { listInventoryVariants, createInventoryVariant } from "@/lib/api/inventory-catalog";
type Params = { params: Promise<{ id: string }> };
export async function GET(request: Request, { params }: Params) {
  try { const ctx = await getAuthContext(request), { id } = await params;
    return ok({ data: await listInventoryVariants(ctx, id) });
  } catch (error) { return handleError(error); }
}
export async function POST(request: Request, { params }: Params) {
  try { const ctx = await getAuthContext(request), { id } = await params;
    return created({ inventoryVariant: await createInventoryVariant(ctx, id, await readCatalogJson(request), request) });
  } catch (error) { return handleError(error); }
}
