import { getSiteSessionContext } from "@/lib/api/require-site-admin";
import { jsonResponse } from "@/lib/api/json-response";
import { handleError } from "@/lib/api/response";
import { exportSiteUsageReport } from "@/lib/ai/site-usage";

export async function GET(request: Request) {
  try {
    const response = jsonResponse(await exportSiteUsageReport(await getSiteSessionContext(request), Object.fromEntries(new URL(request.url).searchParams)));
    response.headers.set("Content-Disposition", 'attachment; filename="ai-site-usage.json"');
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch (err) { return handleError(err); }
}
