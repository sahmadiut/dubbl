import { getAuthContext } from "@/lib/api/auth-context";
import { handleError } from "@/lib/api/response";
import { jsonResponse } from "@/lib/api/json-response";
import { documentAnalyticsQuery } from "@/lib/reports/document-analytics-wire";
import { getPaymentPerformance } from "@/lib/reports/payment-performance";

export async function GET(request: Request) {
  try {
    const ctx = await getAuthContext(request);
    const { input } = documentAnalyticsQuery(request, false);
    return jsonResponse(await getPaymentPerformance(ctx, input));
  } catch (error) { return handleError(error); }
}
