import { documentAnalyticsRoute } from "@/lib/reports/document-analytics-route";

export async function GET(request: Request) {
  return documentAnalyticsRoute(request, "sales-by-customer");
}
