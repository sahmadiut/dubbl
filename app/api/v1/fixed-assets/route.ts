import { getAuthContext } from "@/lib/api/auth-context";
import { handleError } from "@/lib/api/response";
import { jsonResponse } from "@/lib/api/json-response";
import { paginatedResponse } from "@/lib/api/pagination";
import { assetMasterQuery, readAssetJson } from "@/lib/api/asset-master-wire";
import { listFixedAssets, createFixedAsset } from "@/lib/api/asset-master";

export async function GET(request: Request) {
  try {
    const ctx = await getAuthContext(request), result = await listFixedAssets(ctx, assetMasterQuery(new URL(request.url), false));
    return jsonResponse(paginatedResponse(result.assets, result.total, result.page, result.limit));
  } catch (error) { return handleError(error); }
}
export async function POST(request: Request) {
  try {
    const ctx = await getAuthContext(request);
    return jsonResponse({ asset: await createFixedAsset(ctx, await readAssetJson(request), request) }, { status: 201 });
  } catch (error) { return handleError(error); }
}
