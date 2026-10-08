import { getAuthContext } from "@/lib/api/auth-context";
import { ok, handleError, validationError } from "@/lib/api/response";
import { deleteDashboardLayout, getDashboardLayout, updateDashboardLayout } from "@/lib/api/dashboard-layouts";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  try {
    const ctx = await getAuthContext(request);
    return ok(await getDashboardLayout(ctx, (await params).id));
  } catch (err) { return handleError(err); }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const ctx = await getAuthContext(request);
    return ok(await updateDashboardLayout(ctx, (await params).id, await request.json()));
  } catch (err) {
    if (err instanceof SyntaxError) return validationError("Invalid JSON body");
    return handleError(err);
  }
}

export async function DELETE(request: Request, { params }: Params) {
  try {
    const ctx = await getAuthContext(request);
    return ok(await deleteDashboardLayout(ctx, (await params).id));
  } catch (err) { return handleError(err); }
}
