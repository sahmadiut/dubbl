import { AuthError, getAuthContext } from "@/lib/api/auth-context";
import { jsonResponse } from "@/lib/api/json-response";
import { handleError } from "@/lib/api/response";
import { submitRun } from "@/lib/ai/run-lifecycle";
export async function POST(request: Request) {
  try {
    const ctx = await getAuthContext(request);
    const input: unknown = await request.json().catch(() => { throw new AuthError("Invalid JSON request", 400); });
    return jsonResponse(await submitRun(ctx, input));
  }
  catch (err) { return handleError(err); }
}
