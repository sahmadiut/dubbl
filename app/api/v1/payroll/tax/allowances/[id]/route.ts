import { requireRole } from "@/lib/api/require-role";
import { getAuthContext } from "@/lib/api/auth-context";
import { handleError, ok } from "@/lib/api/response";
import { getPayrollTaxAllowance, updatePayrollTaxAllowance, deletePayrollTaxAllowance } from "@/lib/api/payroll-config";
import { readPayrollMasterJson } from "@/lib/api/payroll-master-wire";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getAuthContext(request);
    requireRole(ctx, "manage:tax-config");
    const { id } = await params;
    const result = await getPayrollTaxAllowance(ctx, id);
    return ok({ allowance: result });
  } catch (err) { return handleError(err); }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getAuthContext(request);
    requireRole(ctx, "manage:tax-config");
    const { id } = await params;
    const body = await readPayrollMasterJson(request);
    const result = await updatePayrollTaxAllowance(ctx, id, body, request);
    return ok({ allowance: result });
  } catch (err) { return handleError(err); }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getAuthContext(request);
    requireRole(ctx, "manage:tax-config");
    const { id } = await params;
    const result = await deletePayrollTaxAllowance(ctx, id, request);
    return ok(result);
  } catch (err) { return handleError(err); }
}
