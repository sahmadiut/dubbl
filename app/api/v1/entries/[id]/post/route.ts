import { getAuthContext } from "@/lib/api/auth-context";
import { handleError } from "@/lib/api/response";
import { jsonResponse } from "@/lib/api/json-response";
import { postJournal } from "@/lib/api/journal-lifecycle";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await getAuthContext(request);
    const result = await postJournal(ctx, id, request);
    return jsonResponse({ entry: result.rest });
  } catch (err) { return handleError(err); }
}
