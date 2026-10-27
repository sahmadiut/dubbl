import { AuthError, getAuthContext } from "@/lib/api/auth-context";
import { jsonResponse } from "@/lib/api/json-response";
import { handleError } from "@/lib/api/response";
import { getRunInput } from "@/lib/ai/run-input";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  let response: Response;
  try {
    if (new URL(request.url).search) throw new AuthError("Input query fields are not supported", 400);
    response = jsonResponse(await getRunInput(await getAuthContext(request), { runId: (await context.params).id }));
  } catch (err) { response = handleError(err); }
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
