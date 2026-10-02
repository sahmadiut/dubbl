import { getAuthContext } from "@/lib/api/auth-context";
import { handleError, ok } from "@/lib/api/response";
import { getRecurringJournal, updateRecurringJournal, deleteRecurringJournal } from "@/lib/api/recurring-journal";

type Params = { params: Promise<{ id: string }> };
export async function GET(request: Request, { params }: Params) {
  try {
    const ctx = await getAuthContext(request);
    return ok({ template: await getRecurringJournal(ctx, (await params).id) });
  } catch (err) { return handleError(err); }
}
export async function PATCH(request: Request, { params }: Params) {
  try {
    const ctx = await getAuthContext(request);
    return ok(await updateRecurringJournal(ctx, (await params).id, await request.json(), request));
  } catch (err) { return handleError(err); }
}
export async function DELETE(request: Request, { params }: Params) {
  try {
    const ctx = await getAuthContext(request);
    return ok(await deleteRecurringJournal(ctx, (await params).id, request));
  } catch (err) { return handleError(err); }
}
