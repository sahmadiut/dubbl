import { requireRole } from "@/lib/api/require-role";
import { getAuthContext } from "@/lib/api/auth-context";
import { handleError, ok, created } from "@/lib/api/response";
import { listPayrollContractors, createPayrollContractor } from "@/lib/api/payroll-master";
import { readPayrollMasterJson, payrollMasterQuery } from "@/lib/api/payroll-master-wire";
import { paginatedResponse } from "@/lib/api/pagination";

export async function GET(request: Request) {
  try {
    const ctx = await getAuthContext(request);
    requireRole(ctx, "manage:contractors");
    const result = await listPayrollContractors(ctx, payrollMasterQuery(new URL(request.url), true));
    return ok(paginatedResponse(result.contractors, result.total, result.page, result.limit));
  } catch (error) { return handleError(error); }
}
export async function POST(request: Request) {
  try {
    const ctx = await getAuthContext(request);
    requireRole(ctx, "manage:contractors");
    return created({ contractor: await createPayrollContractor(ctx, await readPayrollMasterJson(request), request) });
  } catch (error) { return handleError(error); }
}
