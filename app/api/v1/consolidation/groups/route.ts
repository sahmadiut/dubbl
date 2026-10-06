import { getAuthContext } from "@/lib/api/auth-context";
import { handleError, ok, created } from "@/lib/api/response";
import { readConsolidationJson } from "@/lib/api/consolidation-config-wire";
import { listConsolidationGroups, createConsolidationGroup } from "@/lib/api/consolidation-config";

export async function GET(request: Request) {
  try {
    const ctx = await getAuthContext(request);
    return ok({ groups: await listConsolidationGroups(ctx) });
  } catch (err) { return handleError(err); }
}

export async function POST(request: Request) {
  try {
    const ctx = await getAuthContext(request);
    return created({ group: await createConsolidationGroup(ctx, await readConsolidationJson(request), request) });
  } catch (err) { return handleError(err); }
}
