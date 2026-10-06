import { getAuthContext } from "@/lib/api/auth-context";
import { handleError } from "@/lib/api/response";
import { jsonResponse } from "@/lib/api/json-response";
import { rollbackAssetDepreciation } from "@/lib/api/asset-depreciation";
import { readDepreciationJson } from "@/lib/api/asset-depreciation-wire";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getAuthContext(request);
    return jsonResponse(await rollbackAssetDepreciation(ctx, (await params).id, await readDepreciationJson(request), request));
  } catch (error) { return handleError(error); }
}
