import { getAuthContext } from "@/lib/api/auth-context";
import { requireRole } from "@/lib/api/require-role";
import { handleError, ok } from "@/lib/api/response";
import { payrollYoy } from "@/lib/api/payroll-outputs";

export async function GET(request: Request) {
  try {
    const ctx = await getAuthContext(request); requireRole(ctx, "view:payroll-reports");
    return ok(await payrollYoy(ctx));
  } catch (error) { return handleError(error); }
}
