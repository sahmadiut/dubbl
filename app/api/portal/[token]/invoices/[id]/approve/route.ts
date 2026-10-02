import { z } from "zod";
import { getPortalAccess, acceptPortalQuote } from "@/lib/api/public-portal";
import { ok, handleError, validationError } from "@/lib/api/response";

export async function POST(request: Request, { params }: { params: Promise<{ token: string; id: string }> }) {
  try {
    const { token, id } = await params;
    const access = await getPortalAccess(token, undefined, 404);
    // No monetary input is supported by this status transition.
    const text = await request.text();
    z.object({}).strict().parse(text.trim() ? JSON.parse(text) : {});
    const updated = await acceptPortalQuote(access, id, request.headers.get("x-forwarded-for"));
    return ok({ quote: { id: updated.id, status: updated.status } });
  } catch (err) {
    if (err instanceof SyntaxError) return validationError("Invalid JSON");
    return handleError(err);
  }
}
