import { getAuthContext } from "@/lib/api/auth-context";
import { handleError } from "@/lib/api/response";
import { jsonResponse } from "@/lib/api/json-response";
import { readPricingJson } from "@/lib/api/pricing-wire";
import { getPriceList, updatePriceList, deletePriceList } from "@/lib/api/pricing";
type Params = { params: Promise<{ id: string }> };
export async function GET(request: Request, { params }: Params) {
  try { return jsonResponse({ priceList: await getPriceList(await getAuthContext(request), (await params).id) }); } catch (err) { return handleError(err); }
}
export async function PATCH(request: Request, { params }: Params) {
  try { return jsonResponse({ priceList: await updatePriceList(await getAuthContext(request), (await params).id, await readPricingJson(request), request) }); } catch (err) { return handleError(err); }
}
export async function DELETE(request: Request, { params }: Params) {
  try { return jsonResponse(await deletePriceList(await getAuthContext(request), (await params).id, request)); } catch (err) { return handleError(err); }
}
