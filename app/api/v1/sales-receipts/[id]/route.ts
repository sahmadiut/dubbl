import { getAuthContext } from "@/lib/api/auth-context";
import { ok, handleError } from "@/lib/api/response";
import { getSalesReceipt, updateSalesReceipt, deleteSalesReceipt } from "@/lib/api/sales-receipts";
import { readSalesReceiptJson } from "@/lib/api/sales-receipt-wire";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { return ok(await getSalesReceipt(await getAuthContext(request), (await params).id)); }
  catch (err) { return handleError(err); }
}
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { const ctx = await getAuthContext(request); return ok(await updateSalesReceipt(ctx, (await params).id, await readSalesReceiptJson(request), request)); }
  catch (err) { return handleError(err); }
}
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { return ok(await deleteSalesReceipt(await getAuthContext(request), (await params).id, request)); }
  catch (err) { return handleError(err); }
}
