import { jsonResponse } from "@/lib/api/json-response";
import { listPayments } from "@/lib/api/payment-reads";
import { createSettlementPayment } from "@/lib/api/payment-settlements";
import { paymentRequestInput } from "@/lib/api/payment-settlement-wire";
import { readCreditJson } from "@/lib/api/credit-wire";
import { getAuthContext } from "@/lib/api/auth-context";
import { handleError } from "@/lib/api/response";
import { paginatedResponse } from "@/lib/api/pagination";

export async function GET(request: Request) {
  try {
    const ctx = await getAuthContext(request);
    const url = new URL(request.url);
    const result = await listPayments(ctx, {
      page: url.searchParams.has("page") ? Number(url.searchParams.get("page")) : undefined,
      limit: url.searchParams.has("limit") ? Number(url.searchParams.get("limit")) : undefined,
      type: url.searchParams.get("type") ?? undefined,
      contactId: url.searchParams.get("contactId") ?? undefined,
    });
    return jsonResponse(paginatedResponse(result.payments, result.total, result.page, result.limit));
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await getAuthContext(request);
    return jsonResponse(await createSettlementPayment(ctx, paymentRequestInput(request, await readCreditJson(request)), request), { status: 201 });
  } catch (err) { return handleError(err); }
}
