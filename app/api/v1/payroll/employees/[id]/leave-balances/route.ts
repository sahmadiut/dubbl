import { getAuthContext } from "@/lib/api/auth-context";
import { handleError, ok } from "@/lib/api/response";
import { getPayrollEmployeeLeaveBalances } from "@/lib/api/payroll-time";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getAuthContext(request);
    const { id } = await params;
    const result = await getPayrollEmployeeLeaveBalances(ctx, id);
    return ok({ data: result });
  } catch (err) { return handleError(err); }
}
