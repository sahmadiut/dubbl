import { getAuthContext } from "@/lib/api/auth-context";
import { handleError } from "@/lib/api/response";
import { jsonResponse } from "@/lib/api/json-response";
import { readAssetJson } from "@/lib/api/asset-master-wire";
import { getAssetCategory, updateAssetCategory, deleteAssetCategory } from "@/lib/api/asset-master";
type Params = { params: Promise<{ id: string }> };
export async function GET(request: Request, { params }: Params) {
  try {
    const ctx = await getAuthContext(request), { id } = await params;
    return jsonResponse({ category: await getAssetCategory(ctx, id) });
  } catch (error) { return handleError(error); }
}
export async function PATCH(request: Request, { params }: Params) {
  try {
    const ctx = await getAuthContext(request), { id } = await params;
    return jsonResponse({ category: await updateAssetCategory(ctx, id, await readAssetJson(request), request) });
  } catch (error) { return handleError(error); }
}
export async function DELETE(request: Request, { params }: Params) {
  try {
    const ctx = await getAuthContext(request), { id } = await params;
    return jsonResponse(await deleteAssetCategory(ctx, id, request));
  } catch (error) { return handleError(error); }
}
