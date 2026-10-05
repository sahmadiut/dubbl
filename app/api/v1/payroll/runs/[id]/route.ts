import { getAuthContext } from "@/lib/api/auth-context";
import { requireRole } from "@/lib/api/require-role";
import { handleError, ok } from "@/lib/api/response";
import { getPayrollRun, updatePayrollRun, deletePayrollRun } from "@/lib/api/payroll-runs";
import { readPayrollMasterJson } from "@/lib/api/payroll-master-wire";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getAuthContext(request);
    requireRole(ctx, "manage:payroll");
    const { id } = await params;
    const result = await getPayrollRun(ctx, id);
    return ok({ run: result });
  } catch (error) { return handleError(error); }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getAuthContext(request);
    requireRole(ctx, "manage:payroll");
    const { id } = await params;
    const result = await updatePayrollRun(ctx, id, await readPayrollMasterJson(request), request);
    return ok({ run: result });
  } catch (error) { return handleError(error); }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getAuthContext(request);
    requireRole(ctx, "manage:payroll");
    const { id } = await params;
    const result = await deletePayrollRun(ctx, id, request);
    return ok(result);
  } catch (error) { return handleError(error); }
}
