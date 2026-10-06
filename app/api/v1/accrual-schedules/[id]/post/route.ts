import { AuthError, getAuthContext } from "@/lib/api/auth-context";
import { handleError, ok } from "@/lib/api/response";
import { postAccrualEntry } from "@/lib/api/accrual-schedules";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getAuthContext(request), { id } = await params, text = await request.text();
    return ok({ entry: await postAccrualEntry(ctx, id, text.trim() ? JSON.parse(text) : {}, request) });
  } catch (err) { return handleError(err instanceof SyntaxError ? new AuthError("Invalid JSON", 400) : err); }
}
