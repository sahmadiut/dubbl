import { AuthError, getAuthContext } from "@/lib/api/auth-context";
import { handleError } from "@/lib/api/response";
import { jsonResponse } from "@/lib/api/json-response";
import { sendPurchaseOrder } from "@/lib/api/purchase-orders";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getAuthContext(request), { id } = await params;
    const text = await request.text();
    let input: unknown = {};
    try { input = text.trim() ? JSON.parse(text) : {}; }
    catch { throw new AuthError("Invalid JSON body", 400); }
    return jsonResponse(await sendPurchaseOrder(ctx, id, input, request));
  } catch (err) { return handleError(err); }
}
