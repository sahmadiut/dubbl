import { kpiAnalyticsRoute } from "@/lib/reports/kpi-analytics-route";

export async function GET(request: Request) {
  return kpiAnalyticsRoute(request, "monthly-trends");
}
