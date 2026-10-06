import { getAuthContext } from "@/lib/api/auth-context";
import { handleError } from "@/lib/api/response";
import { jsonResponse } from "@/lib/api/json-response";
import { readPricingJson } from "@/lib/api/pricing-wire";
import { listPriceItems, addPriceItem } from "@/lib/api/pricing";
type Params = { params: Promise<{ id: string }> };
export async function GET(request: Request, { params }: Params) {
  try { return jsonResponse({ data: await listPriceItems(await getAuthContext(request), (await params).id) }); } catch (err) { return handleError(err); }
}
export async function POST(request: Request, { params }: Params) {
  try { return jsonResponse({ priceListItem: await addPriceItem(await getAuthContext(request), (await params).id, await readPricingJson(request), request) }, { status: 201 }); } catch (err) { return handleError(err); }
}
