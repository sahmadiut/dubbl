import { projectProfitability } from "@/lib/api/project-billing";
import { projectQuery } from "@/lib/api/project-master-wire";
import { jsonResponse } from "@/lib/api/json-response";
import { getAuthContext } from "@/lib/api/auth-context";
import { handleError } from "@/lib/api/response";
import { kpiAnalyticsRoute } from "@/lib/reports/kpi-analytics-route";

export async function GET(request: Request) {
  if (new URL(request.url).searchParams.get("groupBy") !== "project") {
    return kpiAnalyticsRoute(request, "profitability");
  }
  try {
    const ctx = await getAuthContext(request);
    const { groupBy, ...filters } = projectQuery(request);
    void groupBy;
    return jsonResponse(await projectProfitability(ctx, filters));
  } catch (error) { return handleError(error); }
}
