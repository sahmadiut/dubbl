import { requireRole } from "@/lib/api/require-role";
import { getAuthContext } from "@/lib/api/auth-context";
import { handleError, ok, created } from "@/lib/api/response";
import { listPayrollEmployeeDeductions, createPayrollEmployeeDeduction } from "@/lib/api/payroll-config";
import { readPayrollMasterJson } from "@/lib/api/payroll-master-wire";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getAuthContext(request);
    requireRole(ctx, "manage:payroll");
    const { id } = await params;
    const result = await listPayrollEmployeeDeductions(ctx, id);
    return ok({ data: result });
  } catch (err) { return handleError(err); }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getAuthContext(request);
    requireRole(ctx, "manage:payroll");
    const { id } = await params;
    const body = await readPayrollMasterJson(request);
    const result = await createPayrollEmployeeDeduction(ctx, id, body, request);
    return created({ deduction: result });
  } catch (err) { return handleError(err); }
}
