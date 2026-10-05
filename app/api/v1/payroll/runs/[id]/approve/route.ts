import { getAuthContext } from "@/lib/api/auth-context";
import { requireRole } from "@/lib/api/require-role";
import { handleError, ok } from "@/lib/api/response";
import { approvePayrollRun } from "@/lib/api/payroll-runs";
import { emptyTimeBody } from "@/lib/api/payroll-time-wire";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getAuthContext(request);
    requireRole(ctx, "approve:payroll");
    const { id } = await params;
    await emptyTimeBody(request);
    const result = await approvePayrollRun(ctx, id, request);
    return ok({ run: result });
  } catch (error) { return handleError(error); }
}
