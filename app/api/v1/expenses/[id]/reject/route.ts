import { getAuthContext } from "@/lib/api/auth-context";
import { ok, handleError } from "@/lib/api/response";
import { rejectExpenseClaim } from "@/lib/api/expense-claims";
import { readExpenseJson } from "@/lib/api/expense-wire";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getAuthContext(request), { id } = await params;
    return ok(await rejectExpenseClaim(ctx, id, await readExpenseJson(request), request));
  } catch (err) { return handleError(err); }
}
