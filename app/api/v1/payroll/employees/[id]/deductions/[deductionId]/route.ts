import { requireRole } from "@/lib/api/require-role";
import { getAuthContext } from "@/lib/api/auth-context";
import { handleError, ok } from "@/lib/api/response";
import { updatePayrollEmployeeDeduction, deletePayrollEmployeeDeduction } from "@/lib/api/payroll-config";
import { readPayrollMasterJson } from "@/lib/api/payroll-master-wire";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; deductionId: string }> }) {
  try {
    const ctx = await getAuthContext(request);
    requireRole(ctx, "manage:payroll");
    const { id, deductionId } = await params;
    const body = await readPayrollMasterJson(request);
    const result = await updatePayrollEmployeeDeduction(ctx, id, deductionId, body, request);
    return ok({ deduction: result });
  } catch (err) { return handleError(err); }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string; deductionId: string }> }) {
  try {
    const ctx = await getAuthContext(request);
    requireRole(ctx, "manage:payroll");
    const { id, deductionId } = await params;
    const result = await deletePayrollEmployeeDeduction(ctx, id, deductionId, request);
    return ok(result);
  } catch (err) { return handleError(err); }
}
