import { getAuthContext } from "@/lib/api/auth-context";
import { requireRole } from "@/lib/api/require-role";
import { handleError, ok } from "@/lib/api/response";
import { listSelfPayslips } from "@/lib/api/payroll-outputs";

export async function GET(request: Request) {
  try {
    const ctx = await getAuthContext(request); requireRole(ctx, "self-service:payroll");
    return ok({ data: await listSelfPayslips(ctx) });
  } catch (error) { return handleError(error); }
}
