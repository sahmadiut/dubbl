import { AuthError, getAuthContext } from "@/lib/api/auth-context";
import { jsonResponse } from "@/lib/api/json-response";
import { handleError } from "@/lib/api/response";
import { answerRunInput } from "@/lib/ai/run-input";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  let response: Response;
  try {
    if (new URL(request.url).search) throw new AuthError("Answer query fields are not supported", 400);
    const body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body) || "runId" in body) throw new AuthError("Invalid answer body", 400);
    response = jsonResponse(await answerRunInput(await getAuthContext(request), { ...body, runId: (await context.params).id }));
  } catch (err) { response = handleError(err); }
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
