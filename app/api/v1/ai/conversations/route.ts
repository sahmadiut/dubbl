import { getAuthContext } from "@/lib/api/auth-context";
import { jsonResponse } from "@/lib/api/json-response";
import { handleError } from "@/lib/api/response";
import { createConversation, listConversations } from "@/lib/ai/persistence";
import { assertRuntimeEnabled } from "@/lib/ai/run-lifecycle";

export async function GET(request: Request) {
  try { return jsonResponse({ conversations: await listConversations(await getAuthContext(request)) }); }
  catch (err) { return handleError(err); }
}
export async function POST(request: Request) {
  try { const ctx = await getAuthContext(request); assertRuntimeEnabled(); const row = await createConversation(ctx); return jsonResponse({ id: row.id, version: row.version }); }
  catch (err) { return handleError(err); }
}
