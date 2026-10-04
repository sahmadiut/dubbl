import { getAuthContext } from "@/lib/api/auth-context";
import { handleError } from "@/lib/api/response";
import { jsonResponse } from "@/lib/api/json-response";
import { getApprovalRequest } from "@/lib/approvals/service";
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { const ctx = await getAuthContext(request); return jsonResponse({ request: await getApprovalRequest(ctx, (await params).id) }); }
  catch (err) { return handleError(err); }
}
