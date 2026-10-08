import { getAuthContext } from "@/lib/api/auth-context";
import { jsonResponse } from "@/lib/api/json-response";
import { handleError } from "@/lib/api/response";
import { createReportSchedule, listReportSchedules } from "@/lib/reports/schedules";

export async function GET(request: Request) {
  try {
    const ctx = await getAuthContext(request), url = new URL(request.url);
    return jsonResponse(await listReportSchedules(ctx, {
      page: url.searchParams.has("page") ? Number(url.searchParams.get("page")) : undefined,
      // Preserve the existing UI's limit=200 request as a capped 100-item page.
      limit: url.searchParams.has("limit") ? Math.min(100, Number(url.searchParams.get("limit"))) : undefined,
    }));
  } catch (err) { return handleError(err); }
}
export async function POST(request: Request) {
  try { return jsonResponse(await createReportSchedule(await getAuthContext(request), await request.json(), request), { status: 201 }); }
  catch (err) { return handleError(err); }
}
