import { getAuthContext } from "@/lib/api/auth-context";
import { ok, created, handleError } from "@/lib/api/response";
import { readCatalogJson } from "@/lib/api/inventory-catalog-wire";
import { listTransfers, createInventoryTransfer } from "@/lib/api/inventory-movements";

export async function GET(request: Request) {
  try {
    const ctx = await getAuthContext(request);
    return ok({ data: await listTransfers(ctx) });
  } catch (error) { return handleError(error); }
}
export async function POST(request: Request) {
  try {
    const ctx = await getAuthContext(request);
    return created({ transfer: await createInventoryTransfer(ctx, await readCatalogJson(request), request) });
  } catch (error) { return handleError(error); }
}
