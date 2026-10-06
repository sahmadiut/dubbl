import { getAuthContext } from "@/lib/api/auth-context";
import { ok, handleError } from "@/lib/api/response";
import { closeDeal } from "@/lib/api/crm";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getAuthContext(request);
    const { id } = await params;
    return ok({ deal: await closeDeal(ctx, id, "won", {}, request) });
  } catch (err) { return handleError(err); }
}
