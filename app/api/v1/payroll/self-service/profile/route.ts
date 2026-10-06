import { getAuthContext } from "@/lib/api/auth-context";
import { requireRole } from "@/lib/api/require-role";
import { handleError, ok } from "@/lib/api/response";
import { getSelfProfile, updateSelfProfile } from "@/lib/api/payroll-outputs";
import { readPayrollMasterJson } from "@/lib/api/payroll-master-wire";

export async function GET(request: Request) {
  try {
    const ctx = await getAuthContext(request); requireRole(ctx, "self-service:payroll");
    return ok({ employee: await getSelfProfile(ctx) });
  } catch (error) { return handleError(error); }
}
export async function PATCH(request: Request) {
  try {
    const ctx = await getAuthContext(request); requireRole(ctx, "self-service:payroll");
    return ok({ employee: await updateSelfProfile(ctx, await readPayrollMasterJson(request), request) });
  } catch (error) { return handleError(error); }
}
