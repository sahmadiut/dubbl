import { getAuthContext } from "@/lib/api/auth-context";
import { handleError, ok, created } from "@/lib/api/response";
import { readConsolidationJson } from "@/lib/api/consolidation-config-wire";
import { listConsolidationRules, createConsolidationRule } from "@/lib/api/consolidation-config";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await getAuthContext(request);
    return ok(await listConsolidationRules(ctx, id));
  } catch (err) { return handleError(err); }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await getAuthContext(request);
    return created({ rule: await createConsolidationRule(ctx, id, await readConsolidationJson(request), request) });
  } catch (err) { return handleError(err); }
}
