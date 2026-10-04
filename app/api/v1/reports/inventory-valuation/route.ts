import { getAuthContext } from "@/lib/api/auth-context";
import { handleError } from "@/lib/api/response";
import { jsonResponse } from "@/lib/api/json-response";
import { queryInput } from "@/lib/api/inventory-movement-wire";
import { inventoryValuationReport } from "@/lib/api/inventory-valuation-report";
export async function GET(request: Request) {
  try { return jsonResponse(await inventoryValuationReport(await getAuthContext(request), queryInput(request))); } catch (e) { return handleError(e); }
}
