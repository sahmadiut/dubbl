import { getAuthContext } from "@/lib/api/auth-context";
import { handleError, ok } from "@/lib/api/response";
import { getExpenseClaim, updateExpenseClaim, deleteExpenseClaim } from "@/lib/api/expense-crud";
import { readExpenseJson } from "@/lib/api/expense-wire";
type Params = { params: Promise<{ id: string }> };
export async function GET(request: Request, { params }: Params) {
  try { return ok(await getExpenseClaim(await getAuthContext(request), (await params).id)); }
  catch (err) { return handleError(err); }
}
export async function PATCH(request: Request, { params }: Params) {
  try { return ok(await updateExpenseClaim(await getAuthContext(request), (await params).id, await readExpenseJson(request), "rest", request)); }
  catch (err) { return handleError(err); }
}
export async function DELETE(request: Request, { params }: Params) {
  try { return ok(await deleteExpenseClaim(await getAuthContext(request), (await params).id, request)); }
  catch (err) { return handleError(err); }
}
