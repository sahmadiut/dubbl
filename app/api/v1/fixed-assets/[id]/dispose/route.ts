import { getAuthContext } from "@/lib/api/auth-context";
import { handleError } from "@/lib/api/response";
import { jsonResponse } from "@/lib/api/json-response";
import { readAssetJson } from "@/lib/api/asset-master-wire";
import { disposeAsset } from "@/lib/api/asset-valuation";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getAuthContext(request), { id } = await params;
    return jsonResponse(await disposeAsset(ctx, id, await readAssetJson(request), request));
  } catch (error) { return handleError(error); }
}
