import { getAuthContext } from "@/lib/api/auth-context";
import { ok, handleError } from "@/lib/api/response";
import { crmQuery } from "@/lib/api/crm-wire";
import { crmAnalytics } from "@/lib/api/crm";

export async function GET(request: Request) {
  try {
    const ctx = await getAuthContext(request);
    return ok(await crmAnalytics(ctx, crmQuery(request)));
  } catch (err) { return handleError(err); }
}
