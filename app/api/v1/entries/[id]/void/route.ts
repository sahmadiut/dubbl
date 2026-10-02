import { getAuthContext } from "@/lib/api/auth-context";
import { handleError } from "@/lib/api/response";
import { jsonResponse } from "@/lib/api/json-response";
import { voidJournal } from "@/lib/api/journal-lifecycle";
import { z } from "zod";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await getAuthContext(request);
    const { reason } = z.object({ reason: z.string().min(1).describe("Reason for reversing the posted journal") }).parse(await request.json());
    const result = await voidJournal(ctx, id, reason, true, request);
    return jsonResponse({ entry: result.rest });
  } catch (err) { return handleError(err); }
}
