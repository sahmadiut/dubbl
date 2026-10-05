import { getAuthContext } from "@/lib/api/auth-context";
import { handleError, ok, created } from "@/lib/api/response";
import { listPayrollTimesheets, createPayrollTimesheet } from "@/lib/api/payroll-time";
import { readPayrollMasterJson } from "@/lib/api/payroll-master-wire";
import { timeQuery } from "@/lib/api/payroll-time-wire";

export async function GET(request: Request) {
  try {
    const ctx = await getAuthContext(request);
    const result = await listPayrollTimesheets(ctx, timeQuery(new URL(request.url)));
    return ok(result);
  } catch (err) { return handleError(err); }
}

export async function POST(request: Request) {
  try {
    const ctx = await getAuthContext(request);
    const result = await createPayrollTimesheet(ctx, await readPayrollMasterJson(request), request);
    return created({ timesheet: result });
  } catch (err) { return handleError(err); }
}
