import { getAuthContext } from "@/lib/api/auth-context";
import { handleError } from "@/lib/api/response";
import { jsonResponse } from "@/lib/api/json-response";
import { readAssetJson } from "@/lib/api/asset-master-wire";
import { listCwipCosts, addCwipCost } from "@/lib/api/asset-cwip";

type Params = { params: Promise<{ id: string }> };
export async function GET(request: Request, { params }: Params) {
  try { const ctx = await getAuthContext(request); return jsonResponse(await listCwipCosts(ctx, (await params).id)); }
  catch (error) { return handleError(error); }
}
export async function POST(request: Request, { params }: Params) {
  try { const ctx = await getAuthContext(request); return jsonResponse(await addCwipCost(ctx, (await params).id, await readAssetJson(request), request)); }
  catch (error) { return handleError(error); }
}
