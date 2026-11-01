import { getAuthContext } from "@/lib/api/auth-context";
import { jsonResponse } from "@/lib/api/json-response";
import { handleError } from "@/lib/api/response";
import { exportUsageReport } from "@/lib/ai/usage-reports";

export async function GET(request: Request) {
  try {
    const response = jsonResponse(await exportUsageReport(await getAuthContext(request), Object.fromEntries(new URL(request.url).searchParams)));
    response.headers.set("Content-Disposition", 'attachment; filename="ai-usage.json"');
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch (err) { return handleError(err); }
}
