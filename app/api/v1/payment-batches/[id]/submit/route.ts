import { getAuthContext } from "@/lib/api/auth-context";
import { handleError } from "@/lib/api/response";
import { jsonResponse } from "@/lib/api/json-response";
import { submitPaymentBatch } from "@/lib/api/payment-batches";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getAuthContext(request), { id } = await params;
    return jsonResponse(await submitPaymentBatch(ctx, id));
  } catch (err) { return handleError(err); }
}
