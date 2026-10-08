import { getAuthContext } from "@/lib/api/auth-context";
import { ok, handleError, validationError } from "@/lib/api/response";
import { getSavedReport, updateSavedReport, deleteSavedReport } from "@/lib/reports/custom";

type Params = { params: Promise<{ id: string }> };
export async function GET(request: Request, { params }: Params) {
  try { return ok(await getSavedReport(await getAuthContext(request), (await params).id)); }
  catch (err) { return handleError(err); }
}
export async function PATCH(request: Request, { params }: Params) {
  try {
    const ctx = await getAuthContext(request);
    return ok(await updateSavedReport(ctx, (await params).id, await request.json()));
  } catch (err) {
    if (err instanceof SyntaxError) return validationError("Invalid JSON body");
    return handleError(err);
  }
}
export async function DELETE(request: Request, { params }: Params) {
  try { return ok(await deleteSavedReport(await getAuthContext(request), (await params).id, request)); }
  catch (err) { return handleError(err); }
}
