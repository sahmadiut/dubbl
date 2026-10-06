import { getAuthContext } from "@/lib/api/auth-context";
import { handleError } from "@/lib/api/response";
import { jsonResponse } from "@/lib/api/json-response";
import { depreciateAssets } from "@/lib/api/asset-depreciation";
import { readDepreciationJson } from "@/lib/api/asset-depreciation-wire";

export async function POST(request: Request) {
  try {
    const ctx = await getAuthContext(request);
    return jsonResponse(await depreciateAssets(ctx, await readDepreciationJson(request), request));
  } catch (error) { return handleError(error); }
}
