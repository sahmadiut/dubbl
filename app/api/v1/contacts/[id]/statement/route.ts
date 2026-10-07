import { getAuthContext } from "@/lib/api/auth-context";
import { handleError, ok } from "@/lib/api/response";
import { getContactStatement } from "@/lib/api/contact-statements";
import { contactQuery } from "@/lib/api/contact-statement-wire";
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getAuthContext(request);
    const { id } = await params;
    return ok((await getContactStatement(ctx, id, contactQuery(request, "statement"))).data);
  } catch (err) { return handleError(err); }
}
