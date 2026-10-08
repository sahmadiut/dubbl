import { getAuthContext } from "@/lib/api/auth-context";
import { ok, created, handleError, validationError } from "@/lib/api/response";
import { listSavedReports, createSavedReport } from "@/lib/reports/custom";

export async function GET(request: Request) {
  try { return ok(await listSavedReports(await getAuthContext(request))); }
  catch (err) { return handleError(err); }
}
export async function POST(request: Request) {
  try {
    const ctx = await getAuthContext(request);
    return created(await createSavedReport(ctx, await request.json()));
  } catch (err) {
    if (err instanceof SyntaxError) return validationError("Invalid JSON body");
    return handleError(err);
  }
}
