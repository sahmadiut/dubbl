import { getAuthContext } from "@/lib/api/auth-context";
import { ok, handleError } from "@/lib/api/response";
import { applyDebitNote } from "@/lib/api/debit-notes";
import { readDebitNoteJson } from "@/lib/api/debit-note-wire";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { const ctx = await getAuthContext(request); return ok(await applyDebitNote(ctx, (await params).id, await readDebitNoteJson(request), request)); }
  catch (err) { return handleError(err); }
}
