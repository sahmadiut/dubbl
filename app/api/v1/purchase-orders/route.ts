import { getAuthContext } from "@/lib/api/auth-context";
import { handleError } from "@/lib/api/response";
import { jsonResponse } from "@/lib/api/json-response";
import { parsePagination, paginatedResponse } from "@/lib/api/pagination";
import { createPurchaseOrder, listPurchaseOrders } from "@/lib/api/purchase-orders";

export async function GET(request: Request) {
  try {
    const ctx = await getAuthContext(request), url = new URL(request.url);
    const { page, limit } = parsePagination(url);
    const result = await listPurchaseOrders(ctx, { page, limit, status: url.searchParams.get("status") ?? undefined,
      contactId: url.searchParams.get("contactId") ?? undefined }, "rest");
    return jsonResponse(paginatedResponse(result.purchaseOrders, result.total, page, limit));
  } catch (err) { return handleError(err); }
}
export async function POST(request: Request) {
  try { return jsonResponse(await createPurchaseOrder(await getAuthContext(request), await request.json(), request), { status: 201 }); }
  catch (err) { return handleError(err); }
}
