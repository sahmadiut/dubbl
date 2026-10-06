import { getAuthContext } from "@/lib/api/auth-context";
import { handleError, ok } from "@/lib/api/response";
import { readConsolidationJson } from "@/lib/api/consolidation-config-wire";
import { getConsolidationGroup, updateConsolidationGroup, deleteConsolidationGroup } from "@/lib/api/consolidation-config";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await getAuthContext(request);
    return ok({ group: await getConsolidationGroup(ctx, id) });
  } catch (err) { return handleError(err); }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await getAuthContext(request);
    return ok({ group: await updateConsolidationGroup(ctx, id, await readConsolidationJson(request), request) });
  } catch (err) { return handleError(err); }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await getAuthContext(request);
    return ok(await deleteConsolidationGroup(ctx, id, request));
  } catch (err) { return handleError(err); }
}
