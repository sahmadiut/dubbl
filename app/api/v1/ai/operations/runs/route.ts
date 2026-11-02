import { getAuthContext } from "@/lib/api/auth-context";
import { jsonResponse } from "@/lib/api/json-response";
import { handleError } from "@/lib/api/response";
import { listOperationRuns } from "@/lib/ai/operations";

export async function GET(request: Request) {
  try {
    return jsonResponse(await listOperationRuns(await getAuthContext(request), Object.fromEntries(new URL(request.url).searchParams)), { headers: { "Cache-Control": "private, no-store" } });
  } catch (err) { return handleError(err); }
}
