import { getAuthContext } from "@/lib/api/auth-context";
import { ok, handleError } from "@/lib/api/response";
import { warehouseStocks } from "@/lib/api/inventory-movements";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await getAuthContext(request);
    return ok({ data: await warehouseStocks(ctx, id) });
  } catch (error) { return handleError(error); }
}
