import { getAuthContext } from "@/lib/api/auth-context";
import { handleError, ok, validationError } from "@/lib/api/response";
import { previewDocumentEmail } from "@/lib/documents/email-rendering";

export async function POST(request: Request) {
  try { return ok(await previewDocumentEmail(await getAuthContext(request), await request.json())); }
  catch (err) { if (err instanceof SyntaxError) return validationError("Invalid JSON"); return handleError(err); }
}
