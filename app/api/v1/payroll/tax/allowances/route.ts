import { requireRole } from "@/lib/api/require-role";
import { getAuthContext } from "@/lib/api/auth-context";
import { handleError, ok, created } from "@/lib/api/response";
import { listPayrollTaxAllowances, createPayrollTaxAllowance } from "@/lib/api/payroll-config";
import { readPayrollMasterJson } from "@/lib/api/payroll-master-wire";

export async function GET(request: Request) {
  try {
    const ctx = await getAuthContext(request);
    requireRole(ctx, "manage:tax-config");
    const result = await listPayrollTaxAllowances(ctx);
    return ok({ data: result });
  } catch (err) { return handleError(err); }
}

export async function POST(request: Request) {
  try {
    const ctx = await getAuthContext(request);
    requireRole(ctx, "manage:tax-config");
    const body = await readPayrollMasterJson(request);
    const result = await createPayrollTaxAllowance(ctx, body, request);
    return created({ allowance: result });
  } catch (err) { return handleError(err); }
}
