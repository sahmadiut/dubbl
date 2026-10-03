import { getAuthContext } from "@/lib/api/auth-context";
import { handleError } from "@/lib/api/response";
import { jsonResponse } from "@/lib/api/json-response";
import { parsePagination, paginatedResponse } from "@/lib/api/pagination";
import { createPurchaseRequisition, listPurchaseRequisitions } from "@/lib/api/purchase-requisitions";

export async function GET(request: Request) {
  try {
    const ctx = await getAuthContext(request), url = new URL(request.url);
    const { page, limit } = parsePagination(url);
    const result = await listPurchaseRequisitions(ctx, { page, limit, status: url.searchParams.get("status") ?? undefined });
    return jsonResponse(paginatedResponse(result.requisitions, result.total, page, limit));
  } catch (err) { return handleError(err); }
}
export async function POST(request: Request) {
  try { return jsonResponse(await createPurchaseRequisition(await getAuthContext(request), await request.json(), request), { status: 201 }); }
  catch (err) { return err instanceof SyntaxError ? jsonResponse({ error: "Invalid JSON body" }, { status: 400 }) : handleError(err); }
}
