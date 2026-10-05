import { getAuthContext } from "@/lib/api/auth-context";
import { handleError, created } from "@/lib/api/response";
import { createSelfPayrollLeaveRequest } from "@/lib/api/payroll-time";
import { readPayrollMasterJson } from "@/lib/api/payroll-master-wire";

export async function POST(request: Request) {
  try {
    const ctx = await getAuthContext(request);
    const result = await createSelfPayrollLeaveRequest(ctx, await readPayrollMasterJson(request), request);
    return created({ request: result });
  } catch (err) { return handleError(err); }
}
