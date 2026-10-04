import { getAuthContext } from "@/lib/api/auth-context";
import { handleError, ok } from "@/lib/api/response";
import { getExpenseClaimCounts } from "@/lib/api/expense-crud";
export async function GET(request: Request) {
  try { return ok(await getExpenseClaimCounts(await getAuthContext(request))); }
  catch (err) { return handleError(err); }
}
