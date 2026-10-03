import { getAuthContext } from "@/lib/api/auth-context";
import { ok, handleError } from "@/lib/api/response";
import { getQuote, updateQuote, deleteQuote } from "@/lib/api/quotes";

type Params = { params: Promise<{ id: string }> };
export async function GET(request: Request, { params }: Params) {
  try { return ok(await getQuote(await getAuthContext(request), (await params).id)); }
  catch (err) { return handleError(err); }
}
export async function PATCH(request: Request, { params }: Params) {
  try { return ok(await updateQuote(await getAuthContext(request), (await params).id, await request.json(), "rest", request)); }
  catch (err) { return handleError(err); }
}
export async function DELETE(request: Request, { params }: Params) {
  try { return ok(await deleteQuote(await getAuthContext(request), (await params).id, request)); }
  catch (err) { return handleError(err); }
}
