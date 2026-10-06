import { getAuthContext } from "@/lib/api/auth-context";
import { requireRole } from "@/lib/api/require-role";
import { handleError, ok } from "@/lib/api/response";
import { listTaxForms } from "@/lib/api/payroll-outputs";
import { outputQuery } from "@/lib/api/payroll-output-wire";

export async function GET(request: Request) {
  try {
    const ctx = await getAuthContext(request); requireRole(ctx, "manage:payroll");
    return ok(await listTaxForms(ctx, outputQuery(new URL(request.url), true)));
  } catch (error) { return handleError(error); }
}
