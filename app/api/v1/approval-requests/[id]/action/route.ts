import { getAuthContext } from "@/lib/api/auth-context";
import { handleError } from "@/lib/api/response";
import { jsonResponse } from "@/lib/api/json-response";
import { actApprovalRequest } from "@/lib/approvals/service";
import { approvalJson } from "@/lib/approvals/wire";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { const ctx = await getAuthContext(request);
    return jsonResponse({ request: await actApprovalRequest(ctx, (await params).id, await approvalJson(request), request) }); }
  catch (err) { return handleError(err); }
}
