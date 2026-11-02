import { getSiteSessionContext } from "@/lib/api/require-site-admin";
import { jsonResponse } from "@/lib/api/json-response";
import { handleError } from "@/lib/api/response";
import { siteUsageReportPage } from "@/lib/ai/site-usage";

export async function GET(request: Request) {
  try {
    return jsonResponse(await siteUsageReportPage(await getSiteSessionContext(request), Object.fromEntries(new URL(request.url).searchParams)), { headers: { "Cache-Control": "private, no-store" } });
  } catch (err) { return handleError(err); }
}
