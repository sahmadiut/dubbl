import { getAuthContext } from "@/lib/api/auth-context";
import { handleError } from "@/lib/api/response";
import { jsonResponse } from "@/lib/api/json-response";
import { readPricingJson } from "@/lib/api/pricing-wire";
import { updatePriceItem, deletePriceItem } from "@/lib/api/pricing";
type Params = { params: Promise<{ id: string; itemId: string }> };
export async function PATCH(request: Request, { params }: Params) {
  try { const { id, itemId } = await params; return jsonResponse({ priceListItem: await updatePriceItem(await getAuthContext(request), id, itemId, await readPricingJson(request), request) }); } catch (err) { return handleError(err); }
}
export async function DELETE(request: Request, { params }: Params) {
  try { const { id, itemId } = await params; return jsonResponse(await deletePriceItem(await getAuthContext(request), id, itemId, request)); } catch (err) { return handleError(err); }
}
