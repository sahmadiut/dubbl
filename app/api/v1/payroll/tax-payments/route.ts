import { getAuthContext } from "@/lib/api/auth-context";
import { handleError, ok, created } from "@/lib/api/response";
import { readPayrollMasterJson } from "@/lib/api/payroll-master-wire";
import { taxPaymentListSchema } from "@/lib/api/payroll-payment-wire";
import { createPayrollTaxPayment, listPayrollTaxPayments } from "@/lib/api/payroll-payments";
export async function POST(request: Request) {
  try { const ctx = await getAuthContext(request);
    return created(await createPayrollTaxPayment(ctx, await readPayrollMasterJson(request), request)); }
  catch (error) { return handleError(error); }
}
export async function GET(request: Request) {
  try { const ctx = await getAuthContext(request), url = new URL(request.url);
    const p = taxPaymentListSchema.parse({ from: url.searchParams.get("from") ?? undefined, to: url.searchParams.get("to") ?? undefined });
    return ok({ payments: await listPayrollTaxPayments(ctx, p) }); }
  catch (error) { return handleError(error); }
}
