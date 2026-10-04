import { getAuthContext } from "@/lib/api/auth-context";
import { handleError, ok } from "@/lib/api/response";
import { processScheduledPayments } from "@/lib/api/scheduled-payments";

export async function POST(request: Request) {
  try { return ok(await processScheduledPayments(await getAuthContext(request), request)); }
  catch (err) { return handleError(err); }
}
