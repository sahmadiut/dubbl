import { jsonResponse } from "@/lib/api/json-response";
import { getPayment } from "@/lib/api/payment-reads";
import { deletePayment } from "@/lib/api/payment-reversals";
import { getAuthContext } from "@/lib/api/auth-context";
import { handleError, notFound } from "@/lib/api/response";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const ctx = await getAuthContext(request);

    const result = await getPayment(ctx, id);
    if (!result) return notFound("Payment");
    return jsonResponse(result);
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getAuthContext(request);
    return jsonResponse(await deletePayment(ctx, (await params).id, request));
  } catch (err) { return handleError(err); }
}
