import { getAuthContext } from "@/lib/api/auth-context";
import { jsonResponse } from "@/lib/api/json-response";
import { handleError } from "@/lib/api/response";
import { listProviderCatalog } from "@/lib/ai/providers";

export async function GET(request: Request) {
  try { return jsonResponse({ providers: await listProviderCatalog(await getAuthContext(request), true) }); }
  catch (err) { return handleError(err); }
}
