import { getAuthContext } from "@/lib/api/auth-context";
import { ok, handleError } from "@/lib/api/response";
import { applyStockTake } from "@/lib/api/inventory-movements";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await getAuthContext(request);
    return ok(await applyStockTake(ctx, id, undefined, request));
  } catch (error) { return handleError(error); }
}
