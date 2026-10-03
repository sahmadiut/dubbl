import { readCreditJson } from "@/lib/api/credit-wire";
import { getAuthContext } from "@/lib/api/auth-context";
import { ok, handleError } from "@/lib/api/response";
import { applyCredit } from "@/lib/api/credits";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getAuthContext(request), { id } = await params;
    return ok(await applyCredit(ctx, id, await readCreditJson(request), true, request));
  } catch (err) { return handleError(err); }
}
