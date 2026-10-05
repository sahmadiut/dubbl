import { requireRole } from "@/lib/api/require-role";
import { getAuthContext } from "@/lib/api/auth-context";
import { handleError, ok } from "@/lib/api/response";
import { getPayrollEmployeeTaxConfig, updatePayrollEmployeeTaxConfig } from "@/lib/api/payroll-config";
import { readPayrollMasterJson } from "@/lib/api/payroll-master-wire";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getAuthContext(request);
    requireRole(ctx, "manage:payroll");
    const { id } = await params;
    const result = await getPayrollEmployeeTaxConfig(ctx, id, request);
    return ok({ taxConfig: result });
  } catch (err) { return handleError(err); }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getAuthContext(request);
    requireRole(ctx, "manage:payroll");
    const { id } = await params;
    const body = await readPayrollMasterJson(request);
    const result = await updatePayrollEmployeeTaxConfig(ctx, id, body, request);
    return ok({ taxConfig: result });
  } catch (err) { return handleError(err); }
}
