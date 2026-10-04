import { getAuthContext } from "@/lib/api/auth-context";
import { handleError } from "@/lib/api/response";
import { jsonResponse } from "@/lib/api/json-response";
import { readCreditJson } from "@/lib/api/credit-wire";
import { getPaymentBatch, updatePaymentBatch } from "@/lib/api/payment-batches";

type Params = { params: Promise<{ id: string }> };
export async function GET(request: Request, { params }: Params) {
  try {
    const ctx = await getAuthContext(request), { id } = await params;
    return jsonResponse(await getPaymentBatch(ctx, id));
  } catch (err) { return handleError(err); }
}
export async function PATCH(request: Request, { params }: Params) {
  try {
    const ctx = await getAuthContext(request), { id } = await params;
    return jsonResponse(await updatePaymentBatch(ctx, id, await readCreditJson(request)));
  } catch (err) { return handleError(err); }
}
