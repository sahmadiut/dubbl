import { getAuthContext } from "@/lib/api/auth-context";
import { ok, created, handleError, validationError } from "@/lib/api/response";
import { createDashboardLayout, listDashboardLayouts } from "@/lib/api/dashboard-layouts";

export async function GET(request: Request) {
  try {
    return ok(await listDashboardLayouts(await getAuthContext(request)));
  } catch (err) { return handleError(err); }
}

export async function POST(request: Request) {
  try {
    const ctx = await getAuthContext(request);
    return created(await createDashboardLayout(ctx, await request.json()));
  } catch (err) {
    if (err instanceof SyntaxError) return validationError("Invalid JSON body");
    return handleError(err);
  }
}
