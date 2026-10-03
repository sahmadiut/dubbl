import { getAuthContext } from "@/lib/api/auth-context";
import { ok, handleError } from "@/lib/api/response";
import { getDebitNote, updateDebitNote, deleteDebitNote } from "@/lib/api/debit-notes";
import { readDebitNoteJson } from "@/lib/api/debit-note-wire";
type Params = { params: Promise<{ id: string }> };
export async function GET(request: Request, { params }: Params) {
  try { return ok(await getDebitNote(await getAuthContext(request), (await params).id)); } catch (err) { return handleError(err); }
}
export async function PATCH(request: Request, { params }: Params) {
  try { const ctx = await getAuthContext(request); return ok(await updateDebitNote(ctx, (await params).id, await readDebitNoteJson(request), "rest", request)); }
  catch (err) { return handleError(err); }
}
export async function DELETE(request: Request, { params }: Params) {
  try { return ok(await deleteDebitNote(await getAuthContext(request), (await params).id, request)); } catch (err) { return handleError(err); }
}
