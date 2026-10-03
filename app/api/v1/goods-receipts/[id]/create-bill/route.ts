import { getAuthContext } from "@/lib/api/auth-context";
import { handleError } from "@/lib/api/response";
import { jsonResponse } from "@/lib/api/json-response";
import { createBillFromGoodsReceipt } from "@/lib/api/goods-receipts";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    return jsonResponse(await createBillFromGoodsReceipt(await getAuthContext(request), id, request), { status: 201 });
  } catch (err) { return handleError(err); }
}
