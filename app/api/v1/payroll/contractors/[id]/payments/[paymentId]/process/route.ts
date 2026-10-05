import { getAuthContext } from "@/lib/api/auth-context";
import { handleError, ok } from "@/lib/api/response";
import { runProcessBody } from "@/lib/api/payroll-run-wire";
import { processContractorPayment } from "@/lib/api/payroll-payments";
export async function POST(request: Request, { params }: { params: Promise<{ id: string; paymentId: string }> }) {
  try { const ctx = await getAuthContext(request), { id, paymentId } = await params;
    return ok({ payment: await processContractorPayment(ctx, id, paymentId, await runProcessBody(request), request) }); }
  catch (error) { return handleError(error); }
}
