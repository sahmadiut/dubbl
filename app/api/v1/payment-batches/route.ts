import { getAuthContext } from "@/lib/api/auth-context";
import { handleError } from "@/lib/api/response";
import { jsonResponse } from "@/lib/api/json-response";
import { readCreditJson } from "@/lib/api/credit-wire";
import { listPaymentBatches, createPaymentBatch } from "@/lib/api/payment-batches";

export async function GET(request: Request) {
  try {
    const ctx = await getAuthContext(request), query = new URL(request.url).searchParams;
    return jsonResponse(await listPaymentBatches(ctx, {
      page: query.has("page") ? Number(query.get("page")) : undefined,
      limit: query.has("limit") ? Number(query.get("limit")) : undefined,
    }));
  } catch (err) { return handleError(err); }
}
export async function POST(request: Request) {
  try {
    const ctx = await getAuthContext(request);
    return jsonResponse(await createPaymentBatch(ctx, await readCreditJson(request)), { status: 201 });
  } catch (err) { return handleError(err); }
}
