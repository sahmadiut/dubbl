import { getAuthContext } from "@/lib/api/auth-context";
import { requireRole } from "@/lib/api/require-role";
import { handleError, created } from "@/lib/api/response";
import { generateTaxForms } from "@/lib/api/payroll-outputs";
import { readPayrollMasterJson } from "@/lib/api/payroll-master-wire";

export async function POST(request: Request) {
  try {
    const ctx = await getAuthContext(request); requireRole(ctx, "manage:payroll");
    return created(await generateTaxForms(ctx, await readPayrollMasterJson(request), request));
  } catch (error) { return handleError(error); }
}
