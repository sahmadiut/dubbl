import { AuthError, getAuthContext } from "@/lib/api/auth-context";
import { jsonResponse } from "@/lib/api/json-response";
import { handleError } from "@/lib/api/response";
import { reviseActionBatch } from "@/lib/ai/action-batches";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  let response: Response;
  try {
    if (new URL(request.url).search) throw new AuthError("Batch query fields are not supported", 400);
    const ctx = await getAuthContext(request);
    const input: unknown = await request.json().catch(() => { throw new AuthError("Invalid JSON", 400); });
    if (!input || typeof input !== "object" || Array.isArray(input) || Object.hasOwn(input, "runId")) throw new AuthError("Invalid batch revision", 400);
    response = jsonResponse(await reviseActionBatch(ctx, { ...input, runId: (await context.params).id }));
  } catch (err) { response = handleError(err); }
  response.headers.set("Cache-Control", "private, no-store"); return response;
}
