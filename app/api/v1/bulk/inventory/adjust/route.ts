import { getAuthContext } from "@/lib/api/auth-context";
import { ok, handleError } from "@/lib/api/response";
import { readCatalogJson } from "@/lib/api/inventory-catalog-wire";
import { bulkAdjustInventory } from "@/lib/api/inventory-movements";

export async function POST(request: Request) {
  try {
    const ctx = await getAuthContext(request);
    return ok(await bulkAdjustInventory(ctx, await readCatalogJson(request), request));
  } catch (error) { return handleError(error); }
}
