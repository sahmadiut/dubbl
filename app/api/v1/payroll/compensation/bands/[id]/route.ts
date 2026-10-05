import { getAuthContext } from "@/lib/api/auth-context";
import { handleError, ok } from "@/lib/api/response";
import { getCompensationBand, updateCompensationBand, deleteCompensationBand } from "@/lib/api/payroll-compensation";
import { readPayrollMasterJson } from "@/lib/api/payroll-master-wire";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getAuthContext(request);
    const { id } = await params;
    const result = await getCompensationBand(ctx, id);
    return ok({ band: result });
  } catch (err) { return handleError(err); }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getAuthContext(request);
    const { id } = await params;
    const result = await updateCompensationBand(ctx, id, await readPayrollMasterJson(request), request);
    return ok({ band: result });
  } catch (err) { return handleError(err); }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getAuthContext(request);
    const { id } = await params;
    const result = await deleteCompensationBand(ctx, id, request);
    return ok(result);
  } catch (err) { return handleError(err); }
}
