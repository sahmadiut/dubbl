import { getAuthContext } from "@/lib/api/auth-context";
import { handleError, ok, created } from "@/lib/api/response";
import { listCompensationReviews, createCompensationReview } from "@/lib/api/payroll-compensation";
import { readPayrollMasterJson } from "@/lib/api/payroll-master-wire";

export async function GET(request: Request) {
  try {
    const ctx = await getAuthContext(request);
    const result = await listCompensationReviews(ctx);
    return ok(result);
  } catch (err) { return handleError(err); }
}

export async function POST(request: Request) {
  try {
    const ctx = await getAuthContext(request);
    const result = await createCompensationReview(ctx, await readPayrollMasterJson(request), request);
    return created({ review: result });
  } catch (err) { return handleError(err); }
}
