import { getAuthContext } from "@/lib/api/auth-context";
import { handleError } from "@/lib/api/response";
import { jsonResponse } from "@/lib/api/json-response";
import { getLoan, updateLoan, deleteLoan } from "@/lib/api/loans";
import { readLoanJson } from "@/lib/api/loan-wire";
type Params = { params: Promise<{ id: string }> };
export async function GET(request: Request, { params }: Params) {
  try { return jsonResponse(await getLoan(await getAuthContext(request), (await params).id)); }
  catch (err) { return handleError(err); }
}
export async function PATCH(request: Request, { params }: Params) {
  try { return jsonResponse(await updateLoan(await getAuthContext(request), (await params).id, await readLoanJson(request), request)); }
  catch (err) { return handleError(err); }
}
export async function DELETE(request: Request, { params }: Params) {
  try { return jsonResponse(await deleteLoan(await getAuthContext(request), (await params).id, request)); }
  catch (err) { return handleError(err); }
}
