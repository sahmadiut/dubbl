import { getAuthContext } from "@/lib/api/auth-context";
import { handleError, ok } from "@/lib/api/response";
import { readCatalogJson } from "@/lib/api/inventory-catalog-wire";
import { bulkInventoryItems } from "@/lib/api/inventory-master";
export async function POST(request: Request) {
  try { const ctx = await getAuthContext(request); return ok(await bulkInventoryItems(ctx, await readCatalogJson(request), request)); }
  catch (error) { return handleError(error); }
}
