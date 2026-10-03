import { readRecurringInvoiceJson } from "@/lib/api/recurring-invoice-wire";
import { getAuthContext } from "@/lib/api/auth-context";
import { handleError } from "@/lib/api/response";
import { jsonResponse } from "@/lib/api/json-response";
import { getRecurringInvoice, changeRecurringInvoice } from "@/lib/api/recurring-invoice";

type Params = { params: Promise<{ id: string }> };
export async function GET(request: Request, { params }: Params) {
  try { const ctx = await getAuthContext(request); return jsonResponse({ template: await getRecurringInvoice(ctx, (await params).id) }); }
  catch (err) { return handleError(err); }
}
export async function PATCH(request: Request, { params }: Params) {
  try { const ctx = await getAuthContext(request); return jsonResponse(await changeRecurringInvoice(ctx, (await params).id, await readRecurringInvoiceJson(request), request)); }
  catch (err) { return handleError(err); }
}
export async function DELETE(request: Request, { params }: Params) {
  try { const ctx = await getAuthContext(request); return jsonResponse(await changeRecurringInvoice(ctx, (await params).id, {}, request, "delete")); }
  catch (err) { return handleError(err); }
}
