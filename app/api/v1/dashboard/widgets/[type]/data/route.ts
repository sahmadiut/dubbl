import { getAuthContext } from "@/lib/api/auth-context";
import { getDashboardWidget } from "@/lib/api/dashboard-data";
import { dashboardQuery } from "@/lib/api/dashboard-wire";
import { ok, handleError } from "@/lib/api/response";

export async function GET(request: Request, { params }: { params: Promise<{ type: string }> }) {
  try {
    const ctx = await getAuthContext(request);
    const { type } = await params;
    return ok(await getDashboardWidget(ctx, type, dashboardQuery(request)));
  } catch (err) { return handleError(err); }
}
