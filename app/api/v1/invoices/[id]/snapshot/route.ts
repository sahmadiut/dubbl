import { getAuthContext } from "@/lib/api/auth-context";
import { handleError, ok } from "@/lib/api/response";
import { getInvoiceSnapshot, updateInvoiceSnapshot } from "@/lib/api/invoice-snapshots";
import { z } from "zod";

type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, { params }: Context) {
  try {
    const ctx = await getAuthContext(request);
    return ok(await getInvoiceSnapshot(ctx, (await params).id));
  } catch (err) { return handleError(err); }
}
export async function PATCH(request: Request, { params }: Context) {
  try {
    const ctx = await getAuthContext(request);
    const input = await request.json().catch(() => { throw new z.ZodError([{ code: "custom", path: [], message: "Invalid JSON body" }]); });
    return ok(await updateInvoiceSnapshot(ctx, (await params).id, input, request));
  } catch (err) { return handleError(err); }
}
