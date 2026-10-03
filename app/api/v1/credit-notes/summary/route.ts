import { getAuthContext } from "@/lib/api/auth-context";
import { ok, handleError } from "@/lib/api/response";
import { creditNoteSummary } from "@/lib/api/credits";

export async function GET(request: Request) {
  try { return ok(await creditNoteSummary(await getAuthContext(request))); }
  catch (err) { return handleError(err); }
}
