import { getAuthContext } from "@/lib/api/auth-context";
import { handleError } from "@/lib/api/response";
import { jsonResponse } from "@/lib/api/json-response";
import { getBankReconciliationStatus } from "@/lib/reports/bank-analytics";
import { bankAnalyticsQuery } from "@/lib/reports/bank-analytics-wire";

export async function GET(request: Request) {
  try {
    const ctx = await getAuthContext(request);
    return jsonResponse(await getBankReconciliationStatus(ctx, bankAnalyticsQuery(request, false)));
  } catch (err) { return handleError(err); }
}
