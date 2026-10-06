import { getAuthContext } from "@/lib/api/auth-context";
import { requireRole } from "@/lib/api/require-role";
import { handleError, ok } from "@/lib/api/response";
import { listRunPayslips } from "@/lib/api/payroll-outputs";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getAuthContext(request); requireRole(ctx, "manage:payroll");
    return ok({ payslips: await listRunPayslips(ctx, (await params).id) });
  } catch (error) { return handleError(error); }
}
