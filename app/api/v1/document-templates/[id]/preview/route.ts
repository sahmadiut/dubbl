import { getAuthContext } from "@/lib/api/auth-context";
import { handleError, validationError } from "@/lib/api/response";
import { previewDocumentTemplate, renderResponse } from "@/lib/documents/render-service";
import { renderQuery } from "@/lib/documents/render-wire";
import { z } from "zod";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getAuthContext(request);
    const text = await request.text();
    z.strictObject({}).parse(text.trim() ? JSON.parse(text) : {});
    const { id } = await params;
    return renderResponse(await previewDocumentTemplate(ctx, id, renderQuery(request)));
  } catch (err) { if (err instanceof SyntaxError) return validationError("Invalid JSON"); return handleError(err); }
}
