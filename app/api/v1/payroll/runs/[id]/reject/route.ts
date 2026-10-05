import { getAuthContext } from "@/lib/api/auth-context";
import { requireRole } from "@/lib/api/require-role";
import { handleError, ok } from "@/lib/api/response";
import { rejectPayrollRun } from "@/lib/api/payroll-runs";
import { readPayrollMasterJson } from "@/lib/api/payroll-master-wire";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getAuthContext(request);
    requireRole(ctx, "approve:payroll");
    const { id } = await params;
    const result = await rejectPayrollRun(ctx, id, await readPayrollMasterJson(request), request);
    return ok({ run: result });
  } catch (error) { return handleError(error); }
}
