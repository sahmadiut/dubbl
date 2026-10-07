import { getAuthContext } from "@/lib/api/auth-context";
import { getDashboardAlerts } from "@/lib/api/dashboard-data";
import { dashboardQuery } from "@/lib/api/dashboard-wire";
import { ok, handleError } from "@/lib/api/response";

export async function GET(request: Request) {
  try {
    const ctx = await getAuthContext(request);
    return ok(await getDashboardAlerts(ctx, dashboardQuery(request)));
  } catch (err) { return handleError(err); }
}
