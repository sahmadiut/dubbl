import { AuthError, getAuthContext } from "@/lib/api/auth-context";
import { jsonResponse } from "@/lib/api/json-response";
import { handleError } from "@/lib/api/response";
import { previewSettlement } from "@/lib/ai/action-adapters";

export async function POST(request: Request) {
  let response: Response;
  try {
    if (new URL(request.url).search) throw new AuthError("Preview query fields are not supported", 400);
    const ctx = await getAuthContext(request);
    const input = await request.json().catch(() => { throw new AuthError("Invalid JSON", 400); });
    response = jsonResponse(await previewSettlement(ctx, input));
  }
  catch (err) { response = handleError(err); }
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
