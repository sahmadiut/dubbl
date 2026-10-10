import { getAuthContext } from "@/lib/api/auth-context";
import { handleError, ok, validationError } from "@/lib/api/response";
import { resendDocumentEmail } from "@/lib/documents/email-rendering";
import { z } from "zod";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getAuthContext(request);
    const { id } = await params;
    const text = await request.text();
    z.strictObject({}).parse(text.trim() ? JSON.parse(text) : {});
    return ok(await resendDocumentEmail(ctx, id));
  } catch (err) { if (err instanceof SyntaxError) return validationError("Invalid JSON"); return handleError(err); }
}
