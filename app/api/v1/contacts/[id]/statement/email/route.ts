import { AuthError, getAuthContext } from "@/lib/api/auth-context";
import { handleError, ok } from "@/lib/api/response";
import { sendContactStatement } from "@/lib/api/contact-statement-delivery";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getAuthContext(request);
    const { id } = await params;
    const input = await request.json().catch(() => { throw new AuthError("Invalid JSON body", 400); });
    return ok(await sendContactStatement(ctx, id, input));
  } catch (err) { return handleError(err); }
}
