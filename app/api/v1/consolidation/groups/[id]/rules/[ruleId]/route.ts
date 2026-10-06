import { getAuthContext } from "@/lib/api/auth-context";
import { handleError, ok } from "@/lib/api/response";
import { deleteConsolidationRule } from "@/lib/api/consolidation-config";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string; ruleId: string }> }) {
  try {
    const { id, ruleId } = await params;
    const ctx = await getAuthContext(request);
    return ok(await deleteConsolidationRule(ctx, id, ruleId, request));
  } catch (err) { return handleError(err); }
}
