import { getAuthContext } from "@/lib/api/auth-context";
import { handleError, ok } from "@/lib/api/response";
import { getConsolidationReport, persistConsolidationReport } from "@/lib/api/consolidation-report-service";

function window(request: Request) { return Object.fromEntries(new URL(request.url).searchParams); }
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { return ok(await getConsolidationReport(await getAuthContext(request), (await params).id, window(request))); }
  catch (error) { return handleError(error); }
}
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { return ok(await persistConsolidationReport(await getAuthContext(request), (await params).id, window(request), request)); }
  catch (error) { return handleError(error); }
}
