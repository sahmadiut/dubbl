import { getAuthContext } from "@/lib/api/auth-context";
import { ok, handleError } from "@/lib/api/response";
import { readCatalogJson } from "@/lib/api/inventory-catalog-wire";
import { adjustInventory } from "@/lib/api/inventory-movements";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await getAuthContext(request);
    return ok(await adjustInventory(ctx, id, await readCatalogJson(request), false, request));
  } catch (error) { return handleError(error); }
}
