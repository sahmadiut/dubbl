import { getAuthContext } from "@/lib/api/auth-context";
import { handleError, ok } from "@/lib/api/response";
import { getPayrollLeaveRequest, updatePayrollLeaveRequest } from "@/lib/api/payroll-time";
import { readPayrollMasterJson } from "@/lib/api/payroll-master-wire";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getAuthContext(request);
    const { id } = await params;
    const result = await getPayrollLeaveRequest(ctx, id);
    return ok({ request: result });
  } catch (err) { return handleError(err); }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getAuthContext(request);
    const { id } = await params;
    const result = await updatePayrollLeaveRequest(ctx, id, await readPayrollMasterJson(request), request);
    return ok({ request: result });
  } catch (err) { return handleError(err); }
}
