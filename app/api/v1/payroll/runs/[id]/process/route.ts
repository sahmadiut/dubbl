import { getAuthContext } from "@/lib/api/auth-context";
import { requireRole } from "@/lib/api/require-role";
import { handleError, ok } from "@/lib/api/response";
import { processPayrollRun } from "@/lib/api/payroll-runs";
import { runProcessBody } from "@/lib/api/payroll-run-wire";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getAuthContext(request);
    requireRole(ctx, "manage:payroll");
    const { id } = await params;
    const result = await processPayrollRun(ctx, id, await runProcessBody(request), request);
    return ok({ run: result });
  } catch (error) { return handleError(error); }
}
