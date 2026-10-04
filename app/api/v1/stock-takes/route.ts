import { getAuthContext } from "@/lib/api/auth-context";
import { ok, created, handleError } from "@/lib/api/response";
import { readCatalogJson } from "@/lib/api/inventory-catalog-wire";
import { listStockTakes, createStockTake } from "@/lib/api/inventory-movements";

export async function GET(request: Request) {
  try {
    const ctx = await getAuthContext(request);
    return ok({ stockTakes: await listStockTakes(ctx) });
  } catch (error) { return handleError(error); }
}
export async function POST(request: Request) {
  try {
    const ctx = await getAuthContext(request);
    return created({ stockTake: await createStockTake(ctx, await readCatalogJson(request), request) });
  } catch (error) { return handleError(error); }
}
