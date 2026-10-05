import { getAuthContext } from "@/lib/api/auth-context";
import { handleError, ok } from "@/lib/api/response";
import { getSelfPayrollLeaveBalances } from "@/lib/api/payroll-time";

export async function GET(request: Request) {
  try {
    const ctx = await getAuthContext(request);
    const result = await getSelfPayrollLeaveBalances(ctx);
    return ok({ data: result });
  } catch (err) { return handleError(err); }
}
