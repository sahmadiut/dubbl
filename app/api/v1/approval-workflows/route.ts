import { getAuthContext } from "@/lib/api/auth-context";
import { handleError } from "@/lib/api/response";
import { jsonResponse } from "@/lib/api/json-response";
import { listWorkflows, createWorkflow } from "@/lib/approvals/service";
import { approvalQuery, approvalJson } from "@/lib/approvals/wire";
import { paginatedResponse } from "@/lib/api/pagination";
import { requireRole } from "@/lib/api/require-role";
export async function GET(request: Request) {
  try {
    const ctx = await getAuthContext(request);
    const r = await listWorkflows(ctx, approvalQuery(new URL(request.url)));
    return jsonResponse(paginatedResponse(r.workflows, r.total, r.page, r.limit));
  } catch (err) { return handleError(err); }
}
export async function POST(request: Request) {
  try {
    const ctx = await getAuthContext(request); requireRole(ctx, "manage:bills");
    return jsonResponse({ workflow: await createWorkflow(ctx, await approvalJson(request), request) }, { status: 201 });
  } catch (err) { return handleError(err); }
}
