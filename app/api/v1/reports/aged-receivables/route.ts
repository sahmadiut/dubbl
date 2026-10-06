import { agingRoute } from "@/lib/reports/aging-route";

export async function GET(request: Request) {
  return agingRoute(request, "receivables");
}
