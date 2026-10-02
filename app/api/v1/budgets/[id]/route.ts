import { jsonResponse } from "@/lib/api/json-response";
import { getBudget, updateBudget, deleteBudget } from "@/lib/api/budget-write";
import { getAuthContext } from "@/lib/api/auth-context";
import { handleError } from "@/lib/api/response";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const ctx = await getAuthContext(request);

    const found = await getBudget(ctx, id);
    return jsonResponse({ budget: found });
  } catch (err) {
    return handleError(err);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await getAuthContext(request);
    const updated = await updateBudget(ctx, id, await request.json(), request);
    return jsonResponse({ budget: updated });
  } catch (err) { return handleError(err); }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await getAuthContext(request);
    await deleteBudget(ctx, id, request);
    return jsonResponse({ success: true });
  } catch (err) { return handleError(err); }
}
