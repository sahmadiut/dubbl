import { getAuthContext } from "@/lib/api/auth-context";
import { ok, handleError } from "@/lib/api/response";
import { declineQuote } from "@/lib/api/quotes";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { return ok(await declineQuote(await getAuthContext(request), (await params).id, request)); }
  catch (err) { return handleError(err); }
}
