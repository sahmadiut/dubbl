import { getAuthContext } from "@/lib/api/auth-context";
import { requireRole } from "@/lib/api/require-role";
import { handleError, ok, created } from "@/lib/api/response";
import { listPayrollRuns, createPayrollRun } from "@/lib/api/payroll-runs";
import { runQuery } from "@/lib/api/payroll-run-wire";
import { readPayrollMasterJson } from "@/lib/api/payroll-master-wire";

export async function GET(request: Request) {
  try {
    const ctx = await getAuthContext(request);
    requireRole(ctx, "manage:payroll");
    const result = await listPayrollRuns(ctx, runQuery(new URL(request.url)));
    return ok(result);
  } catch (error) { return handleError(error); }
}

export async function POST(request: Request) {
  try {
    const ctx = await getAuthContext(request);
    requireRole(ctx, "manage:payroll");
    const result = await createPayrollRun(ctx, await readPayrollMasterJson(request), request);
    return created({ run: result });
  } catch (error) { return handleError(error); }
}
