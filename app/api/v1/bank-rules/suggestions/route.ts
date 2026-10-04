import { getAuthContext } from "@/lib/api/auth-context";
import { handleError } from "@/lib/api/response";
import { jsonResponse } from "@/lib/api/json-response";
import { getBankRuleSuggestions } from "@/lib/api/bank-rules";
export async function GET(request: Request) {
  try { return jsonResponse(await getBankRuleSuggestions(await getAuthContext(request), { limit: 20, style: "keywords" })); }
  catch (error) { return handleError(error); }
}
