import { getAuthContext } from "@/lib/api/auth-context";
import { ok, handleError } from "@/lib/api/response";
import { submitExpenseClaim } from "@/lib/api/expense-claims";


export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getAuthContext(request), { id } = await params;
    return ok(await submitExpenseClaim(ctx, id, request));
  } catch (err) { return handleError(err); }
}
