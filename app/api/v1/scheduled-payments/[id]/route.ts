import { getAuthContext } from "@/lib/api/auth-context";
import { handleError, ok } from "@/lib/api/response";
import { getScheduledPayment, updateScheduledPayment, deleteScheduledPayment } from "@/lib/api/scheduled-payments";

type Params = { params: Promise<{ id: string }> };
export async function GET(request: Request, { params }: Params) {
  try { return ok(await getScheduledPayment(await getAuthContext(request), (await params).id)); }
  catch (err) { return handleError(err); }
}
export async function PATCH(request: Request, { params }: Params) {
  try { return ok(await updateScheduledPayment(await getAuthContext(request), (await params).id, await request.json(), request)); }
  catch (err) { return handleError(err); }
}
export async function DELETE(request: Request, { params }: Params) {
  try { return ok(await deleteScheduledPayment(await getAuthContext(request), (await params).id, request)); }
  catch (err) { return handleError(err); }
}
