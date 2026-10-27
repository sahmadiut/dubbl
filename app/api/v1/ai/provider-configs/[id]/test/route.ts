import { getAuthContext } from "@/lib/api/auth-context";
import { jsonResponse } from "@/lib/api/json-response";
import { handleError } from "@/lib/api/response";
import { testProviderConnection } from "@/lib/ai/providers";
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try { return jsonResponse(await testProviderConnection(await getAuthContext(request), (await context.params).id)); } catch (err) { return handleError(err); }
}
