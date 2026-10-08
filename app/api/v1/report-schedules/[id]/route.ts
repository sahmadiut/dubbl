import { getAuthContext } from "@/lib/api/auth-context";
import { jsonResponse } from "@/lib/api/json-response";
import { handleError } from "@/lib/api/response";
import { getReportSchedule, updateReportSchedule, deleteReportSchedule } from "@/lib/reports/schedules";

type Params = { params: Promise<{ id: string }> };
export async function GET(request: Request, { params }: Params) {
  try { return jsonResponse(await getReportSchedule(await getAuthContext(request), (await params).id)); }
  catch (err) { return handleError(err); }
}
export async function PATCH(request: Request, { params }: Params) {
  try { return jsonResponse(await updateReportSchedule(await getAuthContext(request), (await params).id, await request.json(), request)); }
  catch (err) { return handleError(err); }
}
export async function DELETE(request: Request, { params }: Params) {
  try { return jsonResponse(await deleteReportSchedule(await getAuthContext(request), (await params).id, request)); }
  catch (err) { return handleError(err); }
}
