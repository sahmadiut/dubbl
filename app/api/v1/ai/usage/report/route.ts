import { getAuthContext } from "@/lib/api/auth-context";
import { jsonResponse } from "@/lib/api/json-response";
import { handleError } from "@/lib/api/response";
import { usageReportPage } from "@/lib/ai/usage-reports";

export async function GET(request: Request) {
  try {
    return jsonResponse(await usageReportPage(await getAuthContext(request), Object.fromEntries(new URL(request.url).searchParams)), { headers: { "Cache-Control": "private, no-store" } });
  } catch (err) { return handleError(err); }
}
