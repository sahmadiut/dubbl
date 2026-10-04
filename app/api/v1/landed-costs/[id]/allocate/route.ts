import { getAuthContext } from "@/lib/api/auth-context";
import { handleError } from "@/lib/api/response";
import { jsonResponse } from "@/lib/api/json-response";
import { allocateLandedCost } from "@/lib/api/landed-costs";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { return jsonResponse(await allocateLandedCost(await getAuthContext(request), (await params).id, request)); } catch (e) { return handleError(e); }
}
