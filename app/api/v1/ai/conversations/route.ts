import { getAuthContext } from "@/lib/api/auth-context";
import { jsonResponse } from "@/lib/api/json-response";
import { handleError } from "@/lib/api/response";
import { listConversations } from "@/lib/ai/persistence";

export async function GET(request: Request) {
  try { return jsonResponse({ conversations: await listConversations(await getAuthContext(request)) }); }
  catch (err) { return handleError(err); }
}
