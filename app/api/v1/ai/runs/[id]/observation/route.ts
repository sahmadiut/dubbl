import { AuthError, getAuthContext } from "@/lib/api/auth-context";
import { jsonResponse } from "@/lib/api/json-response";
import { handleError } from "@/lib/api/response";
import { getRunObservation } from "@/lib/ai/run-progress";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  let response: Response;
  try {
    const query = new URL(request.url).searchParams;
    if ([...query.keys()].some(k => k !== "after" || query.getAll(k).length !== 1) ||
      query.has("after") && !/^(0|[1-9][0-9]{0,9})$/.test(query.get("after")!)) throw new AuthError("Invalid observation query", 400);
    response = jsonResponse(await getRunObservation(await getAuthContext(request), {
      runId: (await context.params).id, ...(query.has("after") ? { after: Number(query.get("after")) } : {}),
    }));
  } catch (err) { response = handleError(err); }
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
