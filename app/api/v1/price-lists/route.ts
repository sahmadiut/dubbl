import { getAuthContext } from "@/lib/api/auth-context";
import { handleError } from "@/lib/api/response";
import { jsonResponse } from "@/lib/api/json-response";
import { readPricingJson } from "@/lib/api/pricing-wire";
import { listPriceLists, createPriceList } from "@/lib/api/pricing";

export async function GET(request: Request) {
  try { return jsonResponse({ data: await listPriceLists(await getAuthContext(request)) }); } catch (err) { return handleError(err); }
}
export async function POST(request: Request) {
  try { return jsonResponse({ priceList: await createPriceList(await getAuthContext(request), await readPricingJson(request), request) }, { status: 201 }); } catch (err) { return handleError(err); }
}
