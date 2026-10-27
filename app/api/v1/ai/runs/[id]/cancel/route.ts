import { getAuthContext } from "@/lib/api/auth-context";
import { jsonResponse } from "@/lib/api/json-response";
import { handleError } from "@/lib/api/response";
import { cancelRun } from "@/lib/ai/run-lifecycle";
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try { return jsonResponse(await cancelRun(await getAuthContext(request), { runId: (await context.params).id })); }
  catch (err) { return handleError(err); }
}
