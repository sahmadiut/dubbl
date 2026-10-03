import { getAuthContext } from "@/lib/api/auth-context";
import { ok, handleError } from "@/lib/api/response";
import { voidInvoice } from "@/lib/api/invoice-lifecycle";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getAuthContext(request);
    const { id } = await params;
    return ok(await voidInvoice(ctx, id, request));
  } catch (err) { return handleError(err); }
}
