import { getAuthContext } from "@/lib/api/auth-context";
import { requireRole } from "@/lib/api/require-role";
import { handleError, ok } from "@/lib/api/response";
import { deletePayrollRunBonus } from "@/lib/api/payroll-runs";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string; bonusId: string }> }) {
  try {
    const ctx = await getAuthContext(request);
    requireRole(ctx, "manage:payroll");
    const { id, bonusId } = await params;
    const result = await deletePayrollRunBonus(ctx, id, bonusId, request);
    return ok(result);
  } catch (error) { return handleError(error); }
}
