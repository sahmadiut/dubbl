import { getAuthContext } from "@/lib/api/auth-context";
import { ok, handleError } from "@/lib/api/response";
import { readCrmJson } from "@/lib/api/crm-wire";
import { getDeal, updateDeal, deleteDeal } from "@/lib/api/crm";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getAuthContext(request);
    const { id } = await params;
    return ok({ deal: await getDeal(ctx, id) });
  } catch (err) { return handleError(err); }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getAuthContext(request);
    const { id } = await params;
    return ok({ deal: await updateDeal(ctx, id, await readCrmJson(request), request) });
  } catch (err) { return handleError(err); }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getAuthContext(request);
    const { id } = await params;
    return ok(await deleteDeal(ctx, id, request));
  } catch (err) { return handleError(err); }
}
