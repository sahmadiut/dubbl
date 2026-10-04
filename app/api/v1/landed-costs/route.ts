import { getAuthContext } from "@/lib/api/auth-context";
import { handleError } from "@/lib/api/response";
import { jsonResponse } from "@/lib/api/json-response";
import { paginatedResponse } from "@/lib/api/pagination";
import { readCatalogJson } from "@/lib/api/inventory-catalog-wire";
import { queryInput } from "@/lib/api/inventory-movement-wire";
import { listLandedCosts, createLandedCost } from "@/lib/api/landed-costs";
export async function GET(request: Request) {
  try { const p = await listLandedCosts(await getAuthContext(request), queryInput(request, ["page", "limit"])); return jsonResponse(paginatedResponse(p.allocations, p.total, p.page, p.limit)); } catch (e) { return handleError(e); }
}
export async function POST(request: Request) {
  try { return jsonResponse({ allocation: await createLandedCost(await getAuthContext(request), await readCatalogJson(request), request) }, { status: 201 }); } catch (e) { return handleError(e); }
}
