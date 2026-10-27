import { getAuthContext } from "@/lib/api/auth-context";
import { jsonResponse } from "@/lib/api/json-response";
import { handleError } from "@/lib/api/response";
import { getRun } from "@/lib/ai/run-lifecycle";
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try { return jsonResponse(await getRun(await getAuthContext(request), { runId: (await context.params).id })); }
  catch (err) { return handleError(err); }
}
