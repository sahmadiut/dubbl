import { handleError } from "@/lib/api/response";
import { renderDocument, renderResponse } from "@/lib/documents/render-service";
import { renderQuery } from "@/lib/documents/render-wire";

export async function GET(request: Request, { params }: { params: Promise<{ token: string; id: string }> }) {
  try {
    const { token, id } = await params;
    return renderResponse(await renderDocument(null, "invoice", id, renderQuery(request), { type: "portal", token }));
  } catch (err) { return handleError(err); }
}
