import { z } from "zod";
import { getAuthContext } from "@/lib/api/auth-context";
import { jsonResponse } from "@/lib/api/json-response";
import { handleError } from "@/lib/api/response";
import { getConversation } from "@/lib/ai/persistence";

// POST prevents the reason entering URL logs or a cached GET transcript.
export async function POST(request: Request, route: { params: Promise<{ id: string }> }) {
  try {
    const input = z.object({ reason: z.string().trim().min(8).max(200) }).strict().parse(await request.json());
    return jsonResponse(await getConversation(await getAuthContext(request), z.string().uuid().parse((await route.params).id), input.reason));
  } catch (err) { return handleError(err); }
}
