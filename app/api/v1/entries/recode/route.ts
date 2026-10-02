import { getAuthContext } from "@/lib/api/auth-context";
import { handleError } from "@/lib/api/response";
import { jsonResponse } from "@/lib/api/json-response";
import { recodeJournals } from "@/lib/api/journal-lifecycle";

export async function POST(request: Request) {
  try {
    const ctx = await getAuthContext(request);
    return jsonResponse(await recodeJournals(ctx, await request.json(), request));
  } catch (err) { return handleError(err); }
}
