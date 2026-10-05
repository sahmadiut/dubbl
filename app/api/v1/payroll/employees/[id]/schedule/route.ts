import { getAuthContext } from "@/lib/api/auth-context";
import { handleError, ok, created } from "@/lib/api/response";
import { listPayrollEmployeeSchedules, createPayrollEmployeeSchedule } from "@/lib/api/payroll-time";
import { readPayrollMasterJson } from "@/lib/api/payroll-master-wire";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getAuthContext(request);
    const { id } = await params;
    const result = await listPayrollEmployeeSchedules(ctx, id);
    return ok({ data: result });
  } catch (err) { return handleError(err); }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getAuthContext(request);
    const { id } = await params;
    const result = await createPayrollEmployeeSchedule(ctx, id, await readPayrollMasterJson(request), request);
    return created({ schedule: result });
  } catch (err) { return handleError(err); }
}
