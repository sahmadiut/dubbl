import { getAuthContext } from "@/lib/api/auth-context";
import { ok, created, handleError } from "@/lib/api/response";
import { readCatalogJson } from "@/lib/api/inventory-catalog-wire";
import { queryInput } from "@/lib/api/inventory-movement-wire";
import { listAllocations, createSerials } from "@/lib/api/inventory-movements";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await getAuthContext(request);
    return ok(await listAllocations(ctx, id, queryInput(request, ["page", "limit"])));
  } catch (error) { return handleError(error); }
}
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await getAuthContext(request);
    return created({ data: await createSerials(ctx, id, await readCatalogJson(request), request) });
  } catch (error) { return handleError(error); }
}
