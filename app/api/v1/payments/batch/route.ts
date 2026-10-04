import { getAuthContext } from "@/lib/api/auth-context";
import { handleError } from "@/lib/api/response";
import { jsonResponse } from "@/lib/api/json-response";
import { readCreditJson } from "@/lib/api/credit-wire";
import { recordPaymentBatch } from "@/lib/api/payment-batches";
import { paymentRequestInput } from "@/lib/api/payment-settlement-wire";

export async function POST(request: Request) {
  try {
    const ctx = await getAuthContext(request);
    return jsonResponse(await recordPaymentBatch(ctx, paymentRequestInput(request, await readCreditJson(request)), request), { status: 201 });
  } catch (err) { return handleError(err); }
}
