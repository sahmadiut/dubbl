import { emptyTimeBody } from "@/lib/api/payroll-time-wire";
import { getAuthContext } from "@/lib/api/auth-context";
import { handleError, ok } from "@/lib/api/response";
import { getPayrollShift, updatePayrollShift, deletePayrollShift } from "@/lib/api/payroll-time";
import { readPayrollMasterJson } from "@/lib/api/payroll-master-wire";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getAuthContext(request);
    const { id } = await params;
    const result = await getPayrollShift(ctx, id);
    return ok({ shift: result });
  } catch (err) { return handleError(err); }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getAuthContext(request);
    const { id } = await params;
    const result = await updatePayrollShift(ctx, id, await readPayrollMasterJson(request), request);
    return ok({ shift: result });
  } catch (err) { return handleError(err); }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getAuthContext(request);
    await emptyTimeBody(request);
    const { id } = await params;
    const result = await deletePayrollShift(ctx, id, request);
    return ok(result);
  } catch (err) { return handleError(err); }
}
