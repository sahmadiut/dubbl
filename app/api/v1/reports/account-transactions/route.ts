import { ledgerDetailResponse } from "@/lib/reports/ledger-detail-response";

export async function GET(request: Request) {
  return ledgerDetailResponse(request, "account-transactions");
}
