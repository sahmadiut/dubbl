import { getAuthContext } from "@/lib/api/auth-context";
import { handleError } from "@/lib/api/response";
import { jsonResponse } from "@/lib/api/json-response";
import { getPurchaseOrderCounts } from "@/lib/api/purchase-orders";

export async function GET(request: Request) {
  try { return jsonResponse(await getPurchaseOrderCounts(await getAuthContext(request))); }
  catch (err) { return handleError(err); }
}
