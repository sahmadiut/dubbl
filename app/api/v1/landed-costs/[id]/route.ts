import { getAuthContext } from "@/lib/api/auth-context";
import { handleError } from "@/lib/api/response";
import { jsonResponse } from "@/lib/api/json-response";
import { readCatalogJson } from "@/lib/api/inventory-catalog-wire";
import { getLandedCost, updateLandedCost, deleteLandedCost } from "@/lib/api/landed-costs";
type Params = { params: Promise<{ id: string }> };
export async function GET(request: Request, { params }: Params) {
  try { return jsonResponse(await getLandedCost(await getAuthContext(request), (await params).id)); } catch (e) { return handleError(e); }
}
export async function PUT(request: Request, { params }: Params) {
  try { return jsonResponse(await updateLandedCost(await getAuthContext(request), (await params).id, await readCatalogJson(request), request)); } catch (e) { return handleError(e); }
}
export async function DELETE(request: Request, { params }: Params) {
  try { return jsonResponse(await deleteLandedCost(await getAuthContext(request), (await params).id, request)); } catch (e) { return handleError(e); }
}
