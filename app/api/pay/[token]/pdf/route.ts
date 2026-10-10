import { handleError } from "@/lib/api/response";
import { renderDocument, renderResponse } from "@/lib/documents/render-service";

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    return renderResponse(await renderDocument(null, "invoice", "", "pdf", { type: "pay", token }));
  } catch (err) { return handleError(err); }
}
