import { getAuthContext } from "@/lib/api/auth-context";
import { requireRole } from "@/lib/api/require-role";
import { handleError, notFound } from "@/lib/api/response";
import { getBill } from "@/lib/api/bill-reads";
import { updateBill, deleteBill } from "@/lib/api/bill-writes";
import { jsonResponse } from "@/lib/api/json-response";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const ctx = await getAuthContext(request);

    const result = await getBill(ctx, id);
    if (!result) return notFound("Bill");
    return jsonResponse(result);
  } catch (err) {
    return handleError(err);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await getAuthContext(request);
    requireRole(ctx, "manage:bills");
    return jsonResponse(await updateBill(ctx, id, await request.json(), request));
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    return jsonResponse(await deleteBill(await getAuthContext(request), id, request));
  } catch (err) {
    return handleError(err);
  }
}
