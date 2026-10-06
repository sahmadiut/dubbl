import { getAuthContext } from "@/lib/api/auth-context";
import { handleError, ok, created } from "@/lib/api/response";
import { readConsolidationJson } from "@/lib/api/consolidation-config-wire";
import { listConsolidationMembers, addConsolidationMember, removeConsolidationMember } from "@/lib/api/consolidation-config";
import { consolidationMemberRemoveSchema } from "@/lib/api/consolidation-config-wire";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await getAuthContext(request);
    return ok(await listConsolidationMembers(ctx, id));
  } catch (err) { return handleError(err); }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await getAuthContext(request);
    return created({ member: await addConsolidationMember(ctx, id, await readConsolidationJson(request), request) });
  } catch (err) { return handleError(err); }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await getAuthContext(request);
    return ok(await removeConsolidationMember(ctx, id, consolidationMemberRemoveSchema.parse(await readConsolidationJson(request)).orgId, request));
  } catch (err) { return handleError(err); }
}
