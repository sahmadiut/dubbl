import { handleError } from "@/lib/api/response";
import { renderPortalStatement } from "@/lib/documents/portal-statement";
import { z } from "zod";

export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const query = new URL(request.url).searchParams;
    const allowed = ["format", "startDate", "endDate", "currencyCode"];
    if ([...query.keys()].some(key => !allowed.includes(key)) || allowed.some(key => query.getAll(key).length > 1))
      throw new z.ZodError([{ code: "custom", path: [], message: "Unsupported or duplicate statement parameter" }]);
    const format = z.enum(["html", "pdf"]).parse(query.get("format") ?? "pdf");
    const input = Object.fromEntries([...query].filter(([key]) => key !== "format"));
    const result = await renderPortalStatement(token, input, format);
    return new Response(format === "pdf" ? new Uint8Array(Buffer.from(result.content, "base64")) : result.content,
      { headers: { "Content-Type": result.contentType, ...(format === "pdf" ? { "Content-Disposition": `attachment; filename="${result.filename}"` } : {}) } });
  } catch (err) { return handleError(err); }
}
