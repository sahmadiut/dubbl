import { jsonResponse } from "@/lib/api/json-response";
import { getAuthContext } from "@/lib/api/auth-context";
import { handleError } from "@/lib/api/response";
import { payDocument } from "@/lib/api/payment-settlements";
import { paymentRequestInput } from "@/lib/api/payment-settlement-wire";
import { readCreditJson } from "@/lib/api/credit-wire";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getAuthContext(request), { id } = await params;
    return jsonResponse(await payDocument(ctx, "invoice", id, paymentRequestInput(request, await readCreditJson(request)), request));
  } catch (err) { return handleError(err); }
}
