import { getAuthContext } from "@/lib/api/auth-context";
import { ok, created, handleError } from "@/lib/api/response";
import { readCrmJson, crmQuery } from "@/lib/api/crm-wire";
import { listDealActivities, addDealActivity } from "@/lib/api/crm";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getAuthContext(request);
    const { id } = await params;
    return ok(await listDealActivities(ctx, id, crmQuery(request)));
  } catch (err) { return handleError(err); }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getAuthContext(request);
    const { id } = await params;
    return created({ activity: await addDealActivity(ctx, id, await readCrmJson(request), request) });
  } catch (err) { return handleError(err); }
}
