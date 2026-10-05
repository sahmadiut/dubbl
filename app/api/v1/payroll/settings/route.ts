import { requireRole } from "@/lib/api/require-role";
import { getAuthContext } from "@/lib/api/auth-context";
import { handleError, ok } from "@/lib/api/response";
import { getPayrollSettings, updatePayrollSettings } from "@/lib/api/payroll-config";
import { readPayrollMasterJson } from "@/lib/api/payroll-master-wire";

export async function GET(request: Request) {
  try {
    const ctx = await getAuthContext(request);
    requireRole(ctx, "manage:payroll");
    const result = await getPayrollSettings(ctx, request);
    return ok({ settings: result });
  } catch (err) { return handleError(err); }
}

export async function PUT(request: Request) {
  try {
    const ctx = await getAuthContext(request);
    requireRole(ctx, "manage:payroll");
    const body = await readPayrollMasterJson(request);
    const result = await updatePayrollSettings(ctx, body, request);
    return ok({ settings: result });
  } catch (err) { return handleError(err); }
}
