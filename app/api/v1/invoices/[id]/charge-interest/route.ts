import { getAuthContext } from "@/lib/api/auth-context";
import { created, handleError } from "@/lib/api/response";
import { chargeInvoiceInterest } from "@/lib/api/invoice-lifecycle";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getAuthContext(request);
    const { id } = await params;
    return created(await chargeInvoiceInterest(ctx, id, await request.json().catch(() => ({})), request));
  } catch (err) { return handleError(err); }
}
