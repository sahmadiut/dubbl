import { cumulativeStatementResponse } from "@/lib/reports/cumulative-response";

export async function GET(request: Request) {
  return cumulativeStatementResponse(request, "balance-sheet");
}
