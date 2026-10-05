import { getAuthContext } from "@/lib/api/auth-context";
import { handleError, ok, created } from "@/lib/api/response";
import { listPayrollLeaveRequests, createPayrollLeaveRequest } from "@/lib/api/payroll-time";
import { readPayrollMasterJson } from "@/lib/api/payroll-master-wire";
import { timeQuery } from "@/lib/api/payroll-time-wire";

export async function GET(request: Request) {
  try {
    const ctx = await getAuthContext(request);
    const result = await listPayrollLeaveRequests(ctx, timeQuery(new URL(request.url), true));
    return ok(result);
  } catch (err) { return handleError(err); }
}

export async function POST(request: Request) {
  try {
    const ctx = await getAuthContext(request);
    const result = await createPayrollLeaveRequest(ctx, await readPayrollMasterJson(request), request);
    return created({ request: result });
  } catch (err) { return handleError(err); }
}
