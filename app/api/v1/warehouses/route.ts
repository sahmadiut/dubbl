import { getAuthContext } from "@/lib/api/auth-context";
import { ok, created, handleError } from "@/lib/api/response";
import { readCatalogJson } from "@/lib/api/inventory-catalog-wire";
import { listWarehouses, writeWarehouse } from "@/lib/api/inventory-movements";

export async function GET(request: Request) {
  try {
    const ctx = await getAuthContext(request);
    return ok({ data: await listWarehouses(ctx) });
  } catch (error) { return handleError(error); }
}
export async function POST(request: Request) {
  try {
    const ctx = await getAuthContext(request);
    return created({ warehouse: await writeWarehouse(ctx, await readCatalogJson(request), undefined, request) });
  } catch (error) { return handleError(error); }
}
