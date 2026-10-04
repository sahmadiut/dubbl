import { getAuthContext } from "@/lib/api/auth-context";
import { handleError } from "@/lib/api/response";
import { jsonResponse } from "@/lib/api/json-response";
import { getBankRule, updateBankRule, deleteBankRule } from "@/lib/api/bank-rules";
import { readBankRuleJson } from "@/lib/api/bank-rule-wire";
type Params = { params: Promise<{ id: string }> };
export async function GET(request: Request, { params }: Params) {
  try { return jsonResponse({ bankRule: await getBankRule(await getAuthContext(request), (await params).id) }); }
  catch (error) { return handleError(error); }
}
export async function PATCH(request: Request, { params }: Params) {
  try { return jsonResponse({ bankRule: await updateBankRule(await getAuthContext(request), (await params).id, await readBankRuleJson(request), request) }); }
  catch (error) { return handleError(error); }
}
export async function DELETE(request: Request, { params }: Params) {
  try { await deleteBankRule(await getAuthContext(request), (await params).id, request); return jsonResponse({ success: true }); }
  catch (error) { return handleError(error); }
}
