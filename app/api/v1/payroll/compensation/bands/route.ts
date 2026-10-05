import { getAuthContext } from "@/lib/api/auth-context";
import { handleError, ok, created } from "@/lib/api/response";
import { listCompensationBands, createCompensationBand } from "@/lib/api/payroll-compensation";
import { readPayrollMasterJson } from "@/lib/api/payroll-master-wire";

export async function GET(request: Request) {
  try {
    const ctx = await getAuthContext(request);
    const result = await listCompensationBands(ctx);
    return ok({ data: result });
  } catch (err) { return handleError(err); }
}

export async function POST(request: Request) {
  try {
    const ctx = await getAuthContext(request);
    const result = await createCompensationBand(ctx, await readPayrollMasterJson(request), request);
    return created({ band: result });
  } catch (err) { return handleError(err); }
}
