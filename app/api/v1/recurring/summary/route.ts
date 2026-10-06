import { getAuthContext } from "@/lib/api/auth-context";
import { handleError } from "@/lib/api/response";
import { jsonResponse } from "@/lib/api/json-response";
import { recurringTemplateSummary } from "@/lib/api/recurring-payable";
export async function GET(request: Request) {
  try { return jsonResponse(await recurringTemplateSummary(await getAuthContext(request))); }
  catch (err) { return handleError(err); }
}
