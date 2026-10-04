import { getAuthContext } from "@/lib/api/auth-context";
import { ok, created, handleError } from "@/lib/api/response";
import { readCatalogJson } from "@/lib/api/inventory-catalog-wire";
import { createAssemblyOrder, listAssemblyOrders } from "@/lib/api/inventory-assembly";

export async function GET(request: Request) {
  try {
    const ctx = await getAuthContext(request);
    return ok(await listAssemblyOrders(ctx));
  } catch (err) { return handleError(err); }
}

export async function POST(request: Request) {
  try {
    const ctx = await getAuthContext(request);
    return created(await createAssemblyOrder(ctx, await readCatalogJson(request), request));
  } catch (err) { return handleError(err); }
}
