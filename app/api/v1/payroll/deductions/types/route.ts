import { requireRole } from "@/lib/api/require-role";
import { getAuthContext } from "@/lib/api/auth-context";
import { handleError, ok, created } from "@/lib/api/response";
import { listPayrollDeductionTypes, createPayrollDeductionType } from "@/lib/api/payroll-config";
import { readPayrollMasterJson } from "@/lib/api/payroll-master-wire";

export async function GET(request: Request) {
  try {
    const ctx = await getAuthContext(request);
    requireRole(ctx, "manage:payroll");
    const result = await listPayrollDeductionTypes(ctx);
    return ok({ data: result });
  } catch (err) { return handleError(err); }
}

export async function POST(request: Request) {
  try {
    const ctx = await getAuthContext(request);
    requireRole(ctx, "manage:payroll");
    const body = await readPayrollMasterJson(request);
    const result = await createPayrollDeductionType(ctx, body, request);
    return created({ deductionType: result });
  } catch (err) { return handleError(err); }
}
