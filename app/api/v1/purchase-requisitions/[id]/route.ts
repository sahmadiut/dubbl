import { getAuthContext } from "@/lib/api/auth-context";
import { handleError } from "@/lib/api/response";
import { jsonResponse } from "@/lib/api/json-response";
import { getPurchaseRequisition, updatePurchaseRequisition, deletePurchaseRequisition } from "@/lib/api/purchase-requisitions";
type Params = { params: Promise<{ id: string }> };
export async function GET(request: Request, { params }: Params) {
  try { return jsonResponse((await getPurchaseRequisition(await getAuthContext(request), (await params).id)).requisition); }
  catch (err) { return handleError(err); }
}
export async function PUT(request: Request, { params }: Params) {
  try { return jsonResponse((await updatePurchaseRequisition(await getAuthContext(request), (await params).id, await request.json(), request)).requisition); }
  catch (err) { return err instanceof SyntaxError ? jsonResponse({ error: "Invalid JSON body" }, { status: 400 }) : handleError(err); }
}
export async function DELETE(request: Request, { params }: Params) {
  try { return jsonResponse(await deletePurchaseRequisition(await getAuthContext(request), (await params).id, request)); }
  catch (err) { return handleError(err); }
}
