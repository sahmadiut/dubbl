import { getAuthContext } from "@/lib/api/auth-context";
import { jsonResponse } from "@/lib/api/json-response";
import { handleError } from "@/lib/api/response";
import { listProviderCatalog, saveProvider } from "@/lib/ai/providers";
export async function GET(request: Request) {
  try { return jsonResponse({ providers: await listProviderCatalog(await getAuthContext(request)) }); } catch (err) { return handleError(err); }
}
export async function POST(request: Request) {
  try { return jsonResponse(await saveProvider(await getAuthContext(request), await request.json()), { status: 201 }); } catch (err) { return handleError(err); }
}
