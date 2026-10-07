import { periodStatementResponse } from "@/lib/reports/period-response";
export async function GET(request: Request) {
  return periodStatementResponse(request, "profit-and-loss");
}
