import { getAuthContext } from "@/lib/api/auth-context";
import { ok, handleError } from "@/lib/api/response";
import { voidDebitNote } from "@/lib/api/debit-notes";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { const ctx = await getAuthContext(request); return ok(await voidDebitNote(ctx, (await params).id, request)); }
  catch (err) { return handleError(err); }
}
