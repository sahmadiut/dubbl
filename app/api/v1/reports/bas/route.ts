import { taxReportResponse } from "@/lib/reports/tax-report-response";

export async function GET(request: Request) {
  return taxReportResponse(request, "bas");
}
