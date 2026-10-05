import { getAuthContext } from "@/lib/api/auth-context";
import { handleError, ok, created } from "@/lib/api/response";
import { readPayrollMasterJson } from "@/lib/api/payroll-master-wire";
import { listContractorPayments, createContractorPayment } from "@/lib/api/payroll-payments";
type Params = { params: Promise<{ id: string }> };
export async function GET(request: Request, { params }: Params) {
  try { const ctx = await getAuthContext(request), { id } = await params; return ok({ data: await listContractorPayments(ctx, id) }); }
  catch (error) { return handleError(error); }
}
export async function POST(request: Request, { params }: Params) {
  try { const ctx = await getAuthContext(request), { id } = await params;
    return created({ payment: await createContractorPayment(ctx, id, await readPayrollMasterJson(request), request) }); }
  catch (error) { return handleError(error); }
}
