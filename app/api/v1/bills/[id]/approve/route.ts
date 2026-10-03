import { getAuthContext } from "@/lib/api/auth-context";
import { handleError } from "@/lib/api/response";
import { jsonResponse } from "@/lib/api/json-response";
import { actBillApproval } from "@/lib/api/bill-lifecycle";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getAuthContext(request);
    const { id } = await params;
    return jsonResponse(await actBillApproval(ctx, id, "approve", {}, request));
  } catch (err) { return handleError(err); }
}
