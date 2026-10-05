import { getAuthContext } from "@/lib/api/auth-context";
import { handleError, ok } from "@/lib/api/response";
import { readPayrollMasterJson } from "@/lib/api/payroll-master-wire";
import { getContractorPayment, updateContractorPayment, deleteContractorPayment } from "@/lib/api/payroll-payments";
type Params = { params: Promise<{ id: string; paymentId: string }> };
export async function GET(request: Request, { params }: Params) {
  try { const ctx = await getAuthContext(request), { id, paymentId } = await params;
    return ok({ payment: await getContractorPayment(ctx, id, paymentId) }); }
  catch (error) { return handleError(error); }
}
export async function PATCH(request: Request, { params }: Params) {
  try { const ctx = await getAuthContext(request), { id, paymentId } = await params;
    return ok({ payment: await updateContractorPayment(ctx, id, paymentId, await readPayrollMasterJson(request), request) }); }
  catch (error) { return handleError(error); }
}
export async function DELETE(request: Request, { params }: Params) {
  try { const ctx = await getAuthContext(request), { id, paymentId } = await params;
    return ok(await deleteContractorPayment(ctx, id, paymentId, request)); }
  catch (error) { return handleError(error); }
}
