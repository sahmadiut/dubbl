import { getAuthContext } from "@/lib/api/auth-context";
import { jsonResponse } from "@/lib/api/json-response";
import { handleError } from "@/lib/api/response";
import { createPrice, listPrices } from "@/lib/ai/usage";
export async function GET(request: Request) {
  try { return jsonResponse({ prices: await listPrices(await getAuthContext(request)) }); } catch (err) { return handleError(err); }
}
export async function POST(request: Request) {
  try { const ctx = await getAuthContext(request); return jsonResponse(await createPrice(ctx, await request.json())); } catch (err) { return handleError(err); }
}
