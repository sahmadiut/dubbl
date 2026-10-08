import { getAuthContext } from "@/lib/api/auth-context";
import { handleError } from "@/lib/api/response";
import { exportSavedReport } from "@/lib/reports/custom";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const result = await exportSavedReport(await getAuthContext(request), (await params).id);
    return new Response(result.csv, { headers: { "Content-Type": result.mimeType,
      "Content-Disposition": `attachment; filename="${result.filename}"` } });
  } catch (err) { return handleError(err); }
}
