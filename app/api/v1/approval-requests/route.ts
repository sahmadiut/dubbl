import { getAuthContext } from "@/lib/api/auth-context";
import { handleError } from "@/lib/api/response";
import { jsonResponse } from "@/lib/api/json-response";
import { listApprovalRequests } from "@/lib/approvals/service";
import { approvalQuery } from "@/lib/approvals/wire";
import { paginatedResponse } from "@/lib/api/pagination";
export async function GET(request: Request) {
  try { const ctx = await getAuthContext(request);
    const r = await listApprovalRequests(ctx, approvalQuery(new URL(request.url), true));
    return jsonResponse(paginatedResponse(r.requests, r.total, r.page, r.limit)); }
  catch (err) { return handleError(err); }
}
