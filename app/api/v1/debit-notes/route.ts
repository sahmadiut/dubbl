import { getAuthContext } from "@/lib/api/auth-context";
import { ok, created, handleError } from "@/lib/api/response";
import { paginatedResponse } from "@/lib/api/pagination";
import { listDebitNotes, createDebitNote } from "@/lib/api/debit-notes";
import { debitNoteListQuery, readDebitNoteJson } from "@/lib/api/debit-note-wire";
export async function GET(request: Request) {
  try { const ctx = await getAuthContext(request), query = debitNoteListQuery(new URL(request.url));
    const result = await listDebitNotes(ctx, query); return ok(paginatedResponse(result.rows, result.total, query.page, query.limit));
  } catch (err) { return handleError(err); }
}
export async function POST(request: Request) {
  try { return created(await createDebitNote(await getAuthContext(request), await readDebitNoteJson(request), "rest", request)); }
  catch (err) { return handleError(err); }
}
