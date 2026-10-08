import { getAuthContext } from "@/lib/api/auth-context";
import { jsonResponse } from "@/lib/api/json-response";
import { handleError } from "@/lib/api/response";
import { processReportScheduleById } from "@/lib/reports/schedule-processor";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { return jsonResponse(await processReportScheduleById((await params).id, await getAuthContext(request))); }
  catch (err) { return handleError(err); }
}
