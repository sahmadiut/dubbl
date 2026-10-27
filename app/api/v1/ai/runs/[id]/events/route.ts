import { getAuthContext, AuthError } from "@/lib/api/auth-context";
import { jsonResponse } from "@/lib/api/json-response";
import { handleError } from "@/lib/api/response";
import { getRunEvents } from "@/lib/ai/run-lifecycle";
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const query = new URL(request.url).searchParams, values = [...query.entries()];
    if (values.some(([k]) => k !== "after") || query.getAll("after").length > 1 || query.has("after") && !/^(0|[1-9][0-9]{0,9})$/.test(query.get("after")!)) throw new AuthError("Invalid event cursor", 400);
    return jsonResponse(await getRunEvents(await getAuthContext(request), { runId: (await context.params).id, after: Number(query.get("after") ?? 0) }));
  } catch (err) { return handleError(err); }
}
