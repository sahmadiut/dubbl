import { getAuthContext } from "@/lib/api/auth-context";
import { requireRole } from "@/lib/api/require-role";
import { handleError, created } from "@/lib/api/response";
import { createTerminationPayrollRun } from "@/lib/api/payroll-runs";
import { readPayrollMasterJson } from "@/lib/api/payroll-master-wire";

export async function POST(request: Request) {
  try {
    const ctx = await getAuthContext(request);
    requireRole(ctx, "manage:payroll");
    const result = await createTerminationPayrollRun(ctx, await readPayrollMasterJson(request), request);
    return created({ run: result });
  } catch (error) { return handleError(error); }
}
