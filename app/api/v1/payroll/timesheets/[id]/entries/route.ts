import { emptyTimeBody } from "@/lib/api/payroll-time-wire";
import { getAuthContext } from "@/lib/api/auth-context";
import { handleError, ok, created } from "@/lib/api/response";
import { listPayrollTimesheetEntries, createPayrollTimesheetEntry, deletePayrollTimesheetEntry } from "@/lib/api/payroll-time";
import { readPayrollMasterJson } from "@/lib/api/payroll-master-wire";
import { timeId } from "@/lib/api/payroll-time-wire";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getAuthContext(request);
    const { id } = await params;
    const result = await listPayrollTimesheetEntries(ctx, id);
    return ok({ data: result });
  } catch (err) { return handleError(err); }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getAuthContext(request);
    const { id } = await params;
    const result = await createPayrollTimesheetEntry(ctx, id, await readPayrollMasterJson(request), request);
    return created({ entry: result });
  } catch (err) { return handleError(err); }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getAuthContext(request);
    await emptyTimeBody(request);
    const { id } = await params;
    const entryId = timeId.parse(new URL(request.url).searchParams.get("entryId"));
    const result = await deletePayrollTimesheetEntry(ctx, id, entryId, request);
    return ok(result);
  } catch (err) { return handleError(err); }
}
