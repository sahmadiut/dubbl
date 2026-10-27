import { getAuthContext, AuthError } from "@/lib/api/auth-context";
import { jsonResponse } from "@/lib/api/json-response";
import { handleError } from "@/lib/api/response";
import { getRunEvents } from "@/lib/ai/run-lifecycle";
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  let response: Response;
  try {
    const query = new URL(request.url).searchParams, values = [...query.entries()];
    if (values.some(([k]) => k !== "after") || query.getAll("after").length > 1 || query.has("after") && !/^(0|[1-9][0-9]{0,9})$/.test(query.get("after")!)) throw new AuthError("Invalid event cursor", 400);
    response = jsonResponse(await getRunEvents(await getAuthContext(request), { runId: (await context.params).id, after: Number(query.get("after") ?? 0) }));
  } catch (err) { response = handleError(err); }
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
