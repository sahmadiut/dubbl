import { getAuthContext } from "@/lib/api/auth-context";
import { jsonResponse } from "@/lib/api/json-response";
import { handleError } from "@/lib/api/response";
import { usageReport } from "@/lib/ai/usage";
export async function GET(request: Request) {
  try { return jsonResponse(await usageReport(await getAuthContext(request), Object.fromEntries(new URL(request.url).searchParams))); } catch (err) { return handleError(err); }
}
