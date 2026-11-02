import { getAuthContext } from "@/lib/api/auth-context";
import { jsonResponse } from "@/lib/api/json-response";
import { handleError } from "@/lib/api/response";
import { disableOperationConfig } from "@/lib/ai/operations";

export async function POST(request: Request) {
  try {
    return jsonResponse(await disableOperationConfig(await getAuthContext(request), await request.json()), { headers: { "Cache-Control": "private, no-store" } });
  } catch (err) { return handleError(err); }
}
