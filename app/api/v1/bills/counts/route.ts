import { getBillCounts } from "@/lib/api/bill-reads";
import { jsonResponse } from "@/lib/api/json-response";
import { getAuthContext } from "@/lib/api/auth-context";
import { handleError } from "@/lib/api/response";

export async function GET(request: Request) {
  try {
    const ctx = await getAuthContext(request);

    return jsonResponse(await getBillCounts(ctx));
  } catch (err) {
    return handleError(err);
  }
}
