import { getAuthContext } from "@/lib/api/auth-context";
import { handleError, ok } from "@/lib/api/response";
import { getBudgetReport } from "@/lib/api/budget-report";
import { budgetReportQuery } from "@/lib/api/budget-report-wire";

export async function GET(request: Request) {
  try {
    const ctx = await getAuthContext(request);
    return ok(await getBudgetReport(ctx, budgetReportQuery(request)));
  } catch (err) { return handleError(err); }
}
