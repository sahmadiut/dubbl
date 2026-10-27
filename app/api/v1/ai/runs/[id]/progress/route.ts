import { AuthError, getAuthContext } from "@/lib/api/auth-context";
import { jsonResponse } from "@/lib/api/json-response";
import { handleError } from "@/lib/api/response";
import { getRunProgress } from "@/lib/ai/run-progress";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  let response: Response;
  try {
    const query = new URL(request.url).searchParams;
    if ([...query.keys()].some(k => !["expectedVersion", "afterStepId", "limit"].includes(k) || query.getAll(k).length !== 1) ||
      ["expectedVersion", "limit"].some(k => query.has(k) && !/^[1-9][0-9]{0,9}$/.test(query.get(k)!))) throw new AuthError("Invalid progress query", 400);
    response = jsonResponse(await getRunProgress(await getAuthContext(request), {
      runId: (await context.params).id,
      ...(query.has("expectedVersion") ? { expectedVersion: Number(query.get("expectedVersion")) } : {}),
      ...(query.has("afterStepId") ? { afterStepId: query.get("afterStepId") } : {}),
      ...(query.has("limit") ? { limit: Number(query.get("limit")) } : {}),
    }));
  } catch (err) { response = handleError(err); }
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
