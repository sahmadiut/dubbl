import { requireRole } from "@/lib/api/require-role";
import { getAuthContext } from "@/lib/api/auth-context";
import { handleError, ok, created } from "@/lib/api/response";
import { listPayrollEmployees, createPayrollEmployee } from "@/lib/api/payroll-master";
import { readPayrollMasterJson, payrollMasterQuery } from "@/lib/api/payroll-master-wire";
import { paginatedResponse } from "@/lib/api/pagination";

export async function GET(request: Request) {
  try {
    const ctx = await getAuthContext(request);
    requireRole(ctx, "manage:payroll");
    const result = await listPayrollEmployees(ctx, payrollMasterQuery(new URL(request.url), false));
    return ok(paginatedResponse(result.employees, result.total, result.page, result.limit));
  } catch (error) { return handleError(error); }
}
export async function POST(request: Request) {
  try {
    const ctx = await getAuthContext(request);
    requireRole(ctx, "manage:payroll");
    return created({ employee: await createPayrollEmployee(ctx, await readPayrollMasterJson(request), request) });
  } catch (error) { return handleError(error); }
}
