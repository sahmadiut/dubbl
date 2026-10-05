import { requireRole } from "@/lib/api/require-role";
import { getAuthContext } from "@/lib/api/auth-context";
import { handleError, ok } from "@/lib/api/response";
import { getPayrollContractor, updatePayrollContractor, deletePayrollContractor } from "@/lib/api/payroll-master";
import { readPayrollMasterJson } from "@/lib/api/payroll-master-wire";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getAuthContext(request);
    requireRole(ctx, "manage:contractors");
    const { id } = await params;
    return ok({ contractor: await getPayrollContractor(ctx, id) });
  } catch (error) { return handleError(error); }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getAuthContext(request);
    requireRole(ctx, "manage:contractors");
    const { id } = await params;
    return ok({ contractor: await updatePayrollContractor(ctx, id, await readPayrollMasterJson(request), request) });
  } catch (error) { return handleError(error); }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getAuthContext(request);
    requireRole(ctx, "manage:contractors");
    const { id } = await params;
    return ok(await deletePayrollContractor(ctx, id, request));
  } catch (error) { return handleError(error); }
}
