import { getAuthContext } from "@/lib/api/auth-context";
import { requireRole } from "@/lib/api/require-role";
import { handleError } from "@/lib/api/response";
import { exportPayroll } from "@/lib/api/payroll-outputs";
import { outputQuery } from "@/lib/api/payroll-output-wire";

export async function GET(request: Request) {
  try {
    const ctx = await getAuthContext(request); requireRole(ctx, "view:payroll-reports");
    const result = await exportPayroll(ctx, outputQuery(new URL(request.url)));
    return new Response(result.csv, { headers: { "Content-Type": result.contentType, "Content-Disposition": 'attachment; filename="' + result.filename + '"' } });
  } catch (error) { return handleError(error); }
}
