import { getAuthContext } from "@/lib/api/auth-context";
import { ok, handleError } from "@/lib/api/response";
import { getCustomerCredit } from "@/lib/api/credits";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getAuthContext(request), { id } = await params;
    return ok(await getCustomerCredit(ctx, id));
  } catch (err) { return handleError(err); }
}
