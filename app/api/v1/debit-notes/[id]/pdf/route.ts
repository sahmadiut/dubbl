import { getAuthContext } from "@/lib/api/auth-context";
import { handleError } from "@/lib/api/response";
import { renderDocument, renderResponse } from "@/lib/documents/render-service";
import { renderQuery } from "@/lib/documents/render-wire";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getAuthContext(request);
    const { id } = await params;
    return renderResponse(await renderDocument(ctx, "debit_note", id, renderQuery(request)));
  } catch (err) { return handleError(err); }
}
