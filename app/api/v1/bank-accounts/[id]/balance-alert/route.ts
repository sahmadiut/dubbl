import { getAuthContext } from "@/lib/api/auth-context";
import { handleError } from "@/lib/api/response";
import { jsonResponse } from "@/lib/api/json-response";
import { setBankBalanceAlert } from "@/lib/api/bank-accounts";
import { readBankAccountJson } from "@/lib/api/bank-account-wire";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { const ctx = await getAuthContext(request); const { id } = await params; return jsonResponse(await setBankBalanceAlert(ctx, id, await readBankAccountJson(request), request)); }
  catch (err) { return handleError(err); }
}
