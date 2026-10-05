import { getAuthContext } from "@/lib/api/auth-context";
import { handleError, ok } from "@/lib/api/response";
import { payrollWhatIf } from "@/lib/api/payroll-compensation";
import { readPayrollMasterJson } from "@/lib/api/payroll-master-wire";

export async function POST(request: Request) {
  try {
    const ctx = await getAuthContext(request);
    const result = await payrollWhatIf(ctx, await readPayrollMasterJson(request));
    return ok(result);
  } catch (err) { return handleError(err); }
}
