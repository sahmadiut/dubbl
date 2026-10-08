import { getAuthContext } from "@/lib/api/auth-context";
import { handleError } from "@/lib/api/response";
import { jsonResponse } from "@/lib/api/json-response";
import { queryInput } from "@/lib/api/inventory-movement-wire";
import { inventoryValuationReport } from "@/lib/api/inventory-valuation-report";
import { z } from "zod";
export async function GET(request: Request) {
  try {
    const ctx = await getAuthContext(request);
    const query = new URL(request.url).searchParams;
    if ([...query.keys()].some(key => query.getAll(key).length > 1))
      throw new z.ZodError([{ code: "custom", path: [], message: "Duplicate valuation parameter" }]);
    return jsonResponse(await inventoryValuationReport(ctx, queryInput(request)));
  } catch (e) { return handleError(e); }
}
