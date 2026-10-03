import { getAuthContext } from "@/lib/api/auth-context";
import { handleError } from "@/lib/api/response";
import { jsonResponse } from "@/lib/api/json-response";
import { getPurchaseOrder, updatePurchaseOrder, deletePurchaseOrder } from "@/lib/api/purchase-orders";

type Params = { params: Promise<{ id: string }> };
export async function GET(request: Request, { params }: Params) {
  try { return jsonResponse(await getPurchaseOrder(await getAuthContext(request), (await params).id)); }
  catch (err) { return handleError(err); }
}
export async function PATCH(request: Request, { params }: Params) {
  try { return jsonResponse(await updatePurchaseOrder(await getAuthContext(request), (await params).id, await request.json(), request)); }
  catch (err) { return handleError(err); }
}
export async function DELETE(request: Request, { params }: Params) {
  try { return jsonResponse(await deletePurchaseOrder(await getAuthContext(request), (await params).id, request)); }
  catch (err) { return handleError(err); }
}
