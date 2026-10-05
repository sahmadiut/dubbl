import { getAuthContext } from "@/lib/api/auth-context";
import { handleError, ok } from "@/lib/api/response";
import { payrollBudgetActual } from "@/lib/api/payroll-compensation";
import { compensationQuery } from "@/lib/api/payroll-compensation-wire";

export async function GET(request: Request) {
  try {
    const ctx = await getAuthContext(request);
    const result = await payrollBudgetActual(ctx, compensationQuery(new URL(request.url), "year"));
    return ok(result);
  } catch (err) { return handleError(err); }
}
