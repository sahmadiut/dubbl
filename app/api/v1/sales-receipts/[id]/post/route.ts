import { getAuthContext } from "@/lib/api/auth-context";
import { ok, handleError } from "@/lib/api/response";
import { postSalesReceipt } from "@/lib/api/sales-receipts";
import { readSalesReceiptJson } from "@/lib/api/sales-receipt-wire";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { const ctx = await getAuthContext(request); return ok(await postSalesReceipt(ctx, (await params).id, await readSalesReceiptJson(request, true), request)); }
  catch (err) { return handleError(err); }
}
