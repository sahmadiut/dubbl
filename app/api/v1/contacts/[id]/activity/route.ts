import { getAuthContext } from "@/lib/api/auth-context";
import { handleError, ok } from "@/lib/api/response";
import { getContactActivity } from "@/lib/api/contact-activity";
import { contactQuery } from "@/lib/api/contact-statement-wire";
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getAuthContext(request);
    const { id } = await params;
    return ok(await getContactActivity(ctx, id, contactQuery(request, "activity")));
  } catch (err) { return handleError(err); }
}
