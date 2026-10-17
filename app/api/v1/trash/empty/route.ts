import { getAuthContext } from "@/lib/api/auth-context";
import { ok, handleError } from "@/lib/api/response";
import { emptyTrash } from "@/lib/api/empty-trash";

export async function POST(request: Request) {
  try { return ok(await emptyTrash(await getAuthContext(request), request)); }
  catch (err) { return handleError(err); }
}
