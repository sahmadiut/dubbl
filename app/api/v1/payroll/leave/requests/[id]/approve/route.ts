import { emptyTimeBody } from "@/lib/api/payroll-time-wire";
import { getAuthContext } from "@/lib/api/auth-context";
import { handleError, ok } from "@/lib/api/response";
import { approvePayrollLeaveRequest } from "@/lib/api/payroll-time";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getAuthContext(request);
    await emptyTimeBody(request);
    const { id } = await params;
    const result = await approvePayrollLeaveRequest(ctx, id, request);
    return ok({ request: result });
  } catch (err) { return handleError(err); }
}
