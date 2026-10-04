import { getAuthContext } from "@/lib/api/auth-context";
import { handleError } from "@/lib/api/response";
import { jsonResponse } from "@/lib/api/json-response";
import { listInventoryCostLayers } from "@/lib/api/inventory-valuation-report";
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { return jsonResponse(await listInventoryCostLayers(await getAuthContext(request), { inventoryItemId: (await params).id })); } catch (e) { return handleError(e); }
}
