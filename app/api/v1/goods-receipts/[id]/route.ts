import { getAuthContext } from "@/lib/api/auth-context";
import { handleError } from "@/lib/api/response";
import { jsonResponse } from "@/lib/api/json-response";
import { getGoodsReceipt } from "@/lib/api/goods-receipts";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    return jsonResponse(await getGoodsReceipt(await getAuthContext(request), id));
  } catch (err) { return handleError(err); }
}
