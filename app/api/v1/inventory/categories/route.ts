import { getAuthContext } from "@/lib/api/auth-context";
import { handleError, ok, created } from "@/lib/api/response";
import { readCatalogJson } from "@/lib/api/inventory-catalog-wire";
import { listInventoryCategories, writeInventoryCategory } from "@/lib/api/inventory-master";
export async function GET(request: Request) {
  try { return ok(await listInventoryCategories(await getAuthContext(request))); }
  catch (error) { return handleError(error); }
}
export async function POST(request: Request) {
  try { const ctx = await getAuthContext(request); return created({ category: await writeInventoryCategory(ctx, await readCatalogJson(request), undefined, request) }); }
  catch (error) { return handleError(error); }
}
