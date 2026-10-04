import { getAuthContext } from "@/lib/api/auth-context";
import { ok, created, handleError } from "@/lib/api/response";
import { readCatalogJson } from "@/lib/api/inventory-catalog-wire";
import { addBomComponent, listBomComponents, removeBomComponent, updateBomComponent } from "@/lib/api/inventory-assembly";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await getAuthContext(request);
    return ok(await updateBomComponent(ctx, id, new URL(request.url).searchParams.get("componentId") ?? "", await readCatalogJson(request), request));
  } catch (err) { return handleError(err); }
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await getAuthContext(request);
    return ok(await listBomComponents(ctx, id));
  } catch (err) { return handleError(err); }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await getAuthContext(request);
    return created(await addBomComponent(ctx, id, await readCatalogJson(request), request));
  } catch (err) { return handleError(err); }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await getAuthContext(request);
    return ok(await removeBomComponent(ctx, id, new URL(request.url).searchParams.get("componentId") ?? "", request));
  } catch (err) { return handleError(err); }
}
