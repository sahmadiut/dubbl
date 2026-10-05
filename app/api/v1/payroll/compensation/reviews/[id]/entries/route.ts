import { getAuthContext } from "@/lib/api/auth-context";
import { handleError, ok, created } from "@/lib/api/response";
import { listCompensationEntries, createCompensationEntry } from "@/lib/api/payroll-compensation";
import { readPayrollMasterJson } from "@/lib/api/payroll-master-wire";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getAuthContext(request);
    const { id } = await params;
    const result = await listCompensationEntries(ctx, id);
    return ok({ data: result });
  } catch (err) { return handleError(err); }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getAuthContext(request);
    const { id } = await params;
    const result = await createCompensationEntry(ctx, id, await readPayrollMasterJson(request), request);
    return created({ entry: result });
  } catch (err) { return handleError(err); }
}
