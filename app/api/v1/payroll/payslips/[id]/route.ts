import { getAuthContext } from "@/lib/api/auth-context";
import { requireRole } from "@/lib/api/require-role";
import { handleError, ok } from "@/lib/api/response";
import { getPayslip } from "@/lib/api/payroll-outputs";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getAuthContext(request); requireRole(ctx, "view:payslips");
    return ok({ payslip: await getPayslip(ctx, (await params).id, request) });
  } catch (error) { return handleError(error); }
}
