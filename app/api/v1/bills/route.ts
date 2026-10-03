import { listBills } from "@/lib/api/bill-reads";
import { createBill, BillDuplicateError } from "@/lib/api/bill-writes";
import { jsonResponse } from "@/lib/api/json-response";
import { getAuthContext } from "@/lib/api/auth-context";
import { requireRole } from "@/lib/api/require-role";
import { handleError } from "@/lib/api/response";
import { parsePagination, paginatedResponse } from "@/lib/api/pagination";

export async function GET(request: Request) {
  try {
    const ctx = await getAuthContext(request);
    const url = new URL(request.url);
    const { page, limit } = parsePagination(url);
    const result = await listBills(ctx, { page, limit, status: url.searchParams.get("status") || undefined });
    return jsonResponse(paginatedResponse(result.bills, result.total, result.page, result.limit));
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await getAuthContext(request);
    requireRole(ctx, "manage:bills");
    return jsonResponse(await createBill(ctx, await request.json(), "rest", request), { status: 201 });
  } catch (err) {
    if (err instanceof BillDuplicateError) return jsonResponse({ error: err.message, ...err.details }, { status: 409 });
    return handleError(err);
  }
}
