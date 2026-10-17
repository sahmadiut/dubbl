import { getAuthContext } from "@/lib/api/auth-context";
import { ok, handleError } from "@/lib/api/response";
import { getDocumentTemplate, updateDocumentTemplate, deleteDocumentTemplate } from "@/lib/api/document-template-settings";

type Params = { params: Promise<{ id: string }> };
export async function GET(request: Request, { params }: Params) {
  try { return ok(await getDocumentTemplate(await getAuthContext(request), (await params).id)); }
  catch (err) { return handleError(err); }
}
export async function PATCH(request: Request, { params }: Params) {
  try { return ok(await updateDocumentTemplate(await getAuthContext(request), (await params).id, await request.json(), request)); }
  catch (err) { return handleError(err); }
}
export async function DELETE(request: Request, { params }: Params) {
  try { return ok(await deleteDocumentTemplate(await getAuthContext(request), (await params).id, request)); }
  catch (err) { return handleError(err); }
}
