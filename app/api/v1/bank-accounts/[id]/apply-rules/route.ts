import { getAuthContext } from "@/lib/api/auth-context";
import { handleError } from "@/lib/api/response";
import { jsonResponse } from "@/lib/api/json-response";
import { applyBankRulesToAccount } from "@/lib/api/bank-rules";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { return jsonResponse(await applyBankRulesToAccount(await getAuthContext(request), (await params).id, request)); }
  catch (error) { return handleError(error); }
}
