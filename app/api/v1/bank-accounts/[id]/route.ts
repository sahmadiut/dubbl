import { getAuthContext } from "@/lib/api/auth-context";
import { handleError } from "@/lib/api/response";
import { jsonResponse } from "@/lib/api/json-response";
import { getBankAccount, updateBankAccount, deleteBankAccount } from "@/lib/api/bank-accounts";
import { readBankAccountJson } from "@/lib/api/bank-account-wire";

type Params = { params: Promise<{ id: string }> };
export async function GET(request: Request, { params }: Params) {
  try { const ctx = await getAuthContext(request); const { id } = await params; return jsonResponse(await getBankAccount(ctx, id)); }
  catch (err) { return handleError(err); }
}
export async function PATCH(request: Request, { params }: Params) {
  try { const ctx = await getAuthContext(request); const { id } = await params; return jsonResponse(await updateBankAccount(ctx, id, await readBankAccountJson(request), request)); }
  catch (err) { return handleError(err); }
}
export async function DELETE(request: Request, { params }: Params) {
  try { const ctx = await getAuthContext(request); const { id } = await params; return jsonResponse(await deleteBankAccount(ctx, id, request)); }
  catch (err) { return handleError(err); }
}
