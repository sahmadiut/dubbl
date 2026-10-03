import { getInvoice } from "@/lib/api/invoice-reads";
import { updateInvoice, deleteInvoice } from "@/lib/api/invoice-writes";
import { jsonResponse } from "@/lib/api/json-response";
import { getAuthContext } from "@/lib/api/auth-context";
import { requireRole } from "@/lib/api/require-role";
import { handleError, notFound } from "@/lib/api/response";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await getAuthContext(request);
    const result = await getInvoice(ctx, id, true);
    if (!result) return notFound("Invoice");
    return jsonResponse(result);
  } catch (err) {
    return handleError(err);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await getAuthContext(request);
    requireRole(ctx, "manage:invoices");
    return jsonResponse(await updateInvoice(ctx, id, await request.json(), request));
  } catch (err) { return handleError(err); }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await getAuthContext(request);
    return jsonResponse(await deleteInvoice(ctx, id, request));
  } catch (err) { return handleError(err); }
}
