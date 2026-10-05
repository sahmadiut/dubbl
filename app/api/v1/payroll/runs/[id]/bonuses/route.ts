import { getAuthContext } from "@/lib/api/auth-context";
import { requireRole } from "@/lib/api/require-role";
import { handleError, ok, created } from "@/lib/api/response";
import { listPayrollRunBonuses, createPayrollRunBonus } from "@/lib/api/payroll-runs";
import { readPayrollMasterJson } from "@/lib/api/payroll-master-wire";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getAuthContext(request);
    requireRole(ctx, "manage:payroll");
    const { id } = await params;
    const result = await listPayrollRunBonuses(ctx, id);
    return ok({ bonuses: result });
  } catch (error) { return handleError(error); }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getAuthContext(request);
    requireRole(ctx, "manage:payroll");
    const { id } = await params;
    const result = await createPayrollRunBonus(ctx, id, await readPayrollMasterJson(request), request);
    return created({ bonus: result });
  } catch (error) { return handleError(error); }
}
