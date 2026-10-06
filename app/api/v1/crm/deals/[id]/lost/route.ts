import { getAuthContext } from "@/lib/api/auth-context";
import { ok, handleError } from "@/lib/api/response";
import { readCrmJson } from "@/lib/api/crm-wire";
import { closeDeal } from "@/lib/api/crm";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getAuthContext(request);
    const { id } = await params;
    return ok({ deal: await closeDeal(ctx, id, "lost", await readCrmJson(request), request) });
  } catch (err) { return handleError(err); }
}
