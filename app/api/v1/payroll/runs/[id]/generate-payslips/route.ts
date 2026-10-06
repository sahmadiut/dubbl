import { getAuthContext } from "@/lib/api/auth-context";
import { requireRole } from "@/lib/api/require-role";
import { handleError, ok } from "@/lib/api/response";
import { generatePayslips } from "@/lib/api/payroll-outputs";
import { emptyOutputSchema } from "@/lib/api/payroll-output-wire";
import { runProcessBody } from "@/lib/api/payroll-run-wire";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getAuthContext(request); requireRole(ctx, "manage:payroll");
    emptyOutputSchema.parse(await runProcessBody(request));
    return ok(await generatePayslips(ctx, (await params).id, request));
  } catch (error) { return handleError(error); }
}
