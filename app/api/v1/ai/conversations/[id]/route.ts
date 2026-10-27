import { z } from "zod";
import { getAuthContext } from "@/lib/api/auth-context";
import { jsonResponse } from "@/lib/api/json-response";
import { handleError } from "@/lib/api/response";
import { getConversation, deleteConversation } from "@/lib/ai/persistence";

type Route = { params: Promise<{ id: string }> };
export async function GET(request: Request, route: Route) {
  try { return jsonResponse(await getConversation(await getAuthContext(request), z.string().uuid().parse((await route.params).id))); }
  catch (err) { return handleError(err); }
}
export async function DELETE(request: Request, route: Route) {
  try { return jsonResponse(await deleteConversation(await getAuthContext(request), z.string().uuid().parse((await route.params).id))); }
  catch (err) { return handleError(err); }
}
