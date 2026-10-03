import { getAuthContext } from "@/lib/api/auth-context";
import { ok, created, handleError } from "@/lib/api/response";
import { listSalesReceipts, createSalesReceipt } from "@/lib/api/sales-receipts";
import { readSalesReceiptJson, salesReceiptListQuery } from "@/lib/api/sales-receipt-wire";
import { paginatedResponse } from "@/lib/api/pagination";

export async function GET(request: Request) {
  try {
    const ctx = await getAuthContext(request), query = salesReceiptListQuery(new URL(request.url));
    const result = await listSalesReceipts(ctx, query);
    return ok(paginatedResponse<unknown>(result.salesReceipts, result.total, query.page, query.limit));
  } catch (err) { return handleError(err); }
}
export async function POST(request: Request) {
  try { const ctx = await getAuthContext(request); return created(await createSalesReceipt(ctx, await readSalesReceiptJson(request), request)); }
  catch (err) { return handleError(err); }
}
