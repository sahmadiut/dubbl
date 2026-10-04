import { getAuthContext } from "@/lib/api/auth-context";
import { ok, created, handleError } from "@/lib/api/response";
import { readCatalogJson } from "@/lib/api/inventory-catalog-wire";
import { createBom, listBoms } from "@/lib/api/inventory-assembly";

export async function GET(request: Request) {
  try {
    const ctx = await getAuthContext(request);
    return ok(await listBoms(ctx));
  } catch (err) { return handleError(err); }
}

export async function POST(request: Request) {
  try {
    const ctx = await getAuthContext(request);
    return created(await createBom(ctx, await readCatalogJson(request), request));
  } catch (err) { return handleError(err); }
}
