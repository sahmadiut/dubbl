import { getAuthContext } from "@/lib/api/auth-context";
import { handleError, ok } from "@/lib/api/response";
import { rejectPayrollTimesheet } from "@/lib/api/payroll-time";
import { readPayrollMasterJson } from "@/lib/api/payroll-master-wire";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getAuthContext(request);
    const { id } = await params;
    const result = await rejectPayrollTimesheet(ctx, id, await readPayrollMasterJson(request), request);
    return ok({ timesheet: result });
  } catch (err) { return handleError(err); }
}
