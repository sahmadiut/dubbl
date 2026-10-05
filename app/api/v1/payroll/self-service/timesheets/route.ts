import { getAuthContext } from "@/lib/api/auth-context";
import { handleError, ok, created } from "@/lib/api/response";
import { listSelfPayrollTimesheets, createSelfPayrollTimesheet } from "@/lib/api/payroll-time";
import { readPayrollMasterJson } from "@/lib/api/payroll-master-wire";

export async function GET(request: Request) {
  try {
    const ctx = await getAuthContext(request);
    const result = await listSelfPayrollTimesheets(ctx);
    return ok({ data: result });
  } catch (err) { return handleError(err); }
}

export async function POST(request: Request) {
  try {
    const ctx = await getAuthContext(request);
    const result = await createSelfPayrollTimesheet(ctx, await readPayrollMasterJson(request), request);
    return created({ timesheet: result });
  } catch (err) { return handleError(err); }
}
