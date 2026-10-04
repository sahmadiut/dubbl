import { getAuthContext } from "@/lib/api/auth-context";
import { handleError } from "@/lib/api/response";
import { jsonResponse } from "@/lib/api/json-response";
import { getWorkflow, updateWorkflow, deleteWorkflow } from "@/lib/approvals/service";
import { approvalJson } from "@/lib/approvals/wire";
import { requireRole } from "@/lib/api/require-role";
type Params = { params: Promise<{ id: string }> };
export async function GET(request: Request, { params }: Params) {
  try { const ctx = await getAuthContext(request); return jsonResponse({ workflow: await getWorkflow(ctx, (await params).id) }); }
  catch (err) { return handleError(err); }
}
export async function PATCH(request: Request, { params }: Params) {
  try { const ctx = await getAuthContext(request); requireRole(ctx, "manage:bills");
    return jsonResponse({ workflow: await updateWorkflow(ctx, (await params).id, await approvalJson(request), request) }); }
  catch (err) { return handleError(err); }
}
export async function DELETE(request: Request, { params }: Params) {
  try { const ctx = await getAuthContext(request); return jsonResponse(await deleteWorkflow(ctx, (await params).id, request)); }
  catch (err) { return handleError(err); }
}
