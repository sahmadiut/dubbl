import { getAuthContext } from "@/lib/api/auth-context";
import { handleError } from "@/lib/api/response";
import { jsonResponse } from "@/lib/api/json-response";
import { paginatedResponse } from "@/lib/api/pagination";
import { listGoodsReceipts, receiveGoodsReceipt } from "@/lib/api/goods-receipts";
import { readGoodsReceiptJson } from "@/lib/api/goods-receipt-wire";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const result = await listGoodsReceipts(await getAuthContext(request), {
      status: url.searchParams.get("status") ?? undefined,
      purchaseOrderId: url.searchParams.get("purchaseOrderId") ?? undefined,
      page: url.searchParams.has("page") ? Number(url.searchParams.get("page")) : undefined,
      limit: url.searchParams.has("limit") ? Number(url.searchParams.get("limit")) : undefined,
    });
    return jsonResponse(paginatedResponse(result.goodsReceipts, result.total, result.page, result.limit));
  } catch (err) { return handleError(err); }
}
export async function POST(request: Request) {
  try { return jsonResponse(await receiveGoodsReceipt(await getAuthContext(request), await readGoodsReceiptJson(request), request), { status: 201 }); }
  catch (err) { return handleError(err); }
}
