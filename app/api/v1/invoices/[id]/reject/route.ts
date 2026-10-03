import { getAuthContext } from "@/lib/api/auth-context";
import { ok, handleError } from "@/lib/api/response";
import { actInvoiceApproval } from "@/lib/api/invoice-lifecycle";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getAuthContext(request);
    const { id } = await params;
    return ok(await actInvoiceApproval(ctx, id, "reject", await request.json().catch(() => ({})), request));
  } catch (err) { return handleError(err); }
}
