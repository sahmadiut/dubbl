import { getAuthContext } from "@/lib/api/auth-context";
import { ok, created, handleError } from "@/lib/api/response";
import { listDocumentTemplates, createDocumentTemplate } from "@/lib/api/document-template-settings";

export async function GET(request: Request) {
  try { return ok(await listDocumentTemplates(await getAuthContext(request))); }
  catch (err) { return handleError(err); }
}
export async function POST(request: Request) {
  try { return created(await createDocumentTemplate(await getAuthContext(request), await request.json(), request)); }
  catch (err) { return handleError(err); }
}
