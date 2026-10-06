import { getAuthContext } from "@/lib/api/auth-context";
import { ok, created, handleError } from "@/lib/api/response";
import { readCrmJson, crmQuery } from "@/lib/api/crm-wire";
import { listDeals, createDeal } from "@/lib/api/crm";

export async function GET(request: Request) {
  try {
    const ctx = await getAuthContext(request);
    return ok(await listDeals(ctx, crmQuery(request)));
  } catch (err) { return handleError(err); }
}

export async function POST(request: Request) {
  try {
    const ctx = await getAuthContext(request);
    return created({ deal: await createDeal(ctx, await readCrmJson(request), request) });
  } catch (err) { return handleError(err); }
}
