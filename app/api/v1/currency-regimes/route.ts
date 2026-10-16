import { getAuthContext } from "@/lib/api/auth-context";
import { jsonResponse } from "@/lib/api/json-response";
import { handleError } from "@/lib/api/response";
import { listCurrencyRegimes } from "@/lib/currency/regimes";

export async function GET(request: Request) {
  try {
    const ctx = await getAuthContext(request);
    return jsonResponse(await listCurrencyRegimes(ctx, Object.fromEntries(new URL(request.url).searchParams)));
  } catch (err) { return handleError(err); }
}
