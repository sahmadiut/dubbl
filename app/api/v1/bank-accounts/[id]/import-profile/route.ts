import { getAuthContext } from "@/lib/api/auth-context";
import { handleError } from "@/lib/api/response";
import { jsonResponse } from "@/lib/api/json-response";
import { readBankAccountJson } from "@/lib/api/bank-account-wire";
import { getBankImportProfile, saveBankImportProfile, deleteBankImportProfile } from "@/lib/api/bank-imports";

type Params = { params: Promise<{ id: string }> };
export async function GET(request: Request, { params }: Params) {
  try { return jsonResponse(await getBankImportProfile(await getAuthContext(request), (await params).id)); }
  catch (error) { return handleError(error); }
}
export async function PUT(request: Request, { params }: Params) {
  try { return jsonResponse(await saveBankImportProfile(await getAuthContext(request), (await params).id, await readBankAccountJson(request))); }
  catch (error) { return handleError(error); }
}
export async function DELETE(request: Request, { params }: Params) {
  try { return jsonResponse(await deleteBankImportProfile(await getAuthContext(request), (await params).id)); }
  catch (error) { return handleError(error); }
}
