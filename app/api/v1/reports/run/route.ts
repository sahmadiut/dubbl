import { getAuthContext } from "@/lib/api/auth-context";
import { ok, handleError, validationError } from "@/lib/api/response";
import { runCustomReport } from "@/lib/reports/custom";

export async function POST(request: Request) {
  try {
    const ctx = await getAuthContext(request);
    return ok(await runCustomReport(ctx, await request.json()));
  } catch (err) {
    if (err instanceof SyntaxError) return validationError("Invalid JSON body");
    return handleError(err);
  }
}
