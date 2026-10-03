import { readCreditJson } from "@/lib/api/credit-wire";
import { getAuthContext } from "@/lib/api/auth-context";
import { ok, handleError } from "@/lib/api/response";
import { getCreditNote, updateCreditNote, deleteCreditNote } from "@/lib/api/credits";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getAuthContext(request), { id } = await params;
    return ok(await getCreditNote(ctx, id));
  } catch (err) { return handleError(err); }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getAuthContext(request), { id } = await params;
    return ok(await updateCreditNote(ctx, id, await readCreditJson(request), "rest", request));
  } catch (err) { return handleError(err); }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getAuthContext(request), { id } = await params;
    return ok(await deleteCreditNote(ctx, id, request));
  } catch (err) { return handleError(err); }
}
