import { getAuthContext } from "@/lib/api/auth-context";
import { handleError } from "@/lib/api/response";
import { jsonResponse } from "@/lib/api/json-response";
import { decidePurchaseRequisition } from "@/lib/api/purchase-requisitions";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { return jsonResponse((await decidePurchaseRequisition(await getAuthContext(request), (await params).id, "approve", {}, request)).requisition); }
  catch (err) { return err instanceof SyntaxError ? jsonResponse({ error: "Invalid JSON body" }, { status: 400 }) : handleError(err); }
}
