import { getAuthContext } from "@/lib/api/auth-context";
import { handleError } from "@/lib/api/response";
import { jsonResponse } from "@/lib/api/json-response";
import { listBankAccounts, createBankAccount } from "@/lib/api/bank-accounts";
import { readBankAccountJson } from "@/lib/api/bank-account-wire";

export async function GET(request: Request) {
  try { return jsonResponse(await listBankAccounts(await getAuthContext(request))); }
  catch (err) { return handleError(err); }
}
export async function POST(request: Request) {
  try { const ctx = await getAuthContext(request); return jsonResponse(await createBankAccount(ctx, await readBankAccountJson(request), request), { status: 201 }); }
  catch (err) { return handleError(err); }
}
