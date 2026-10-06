import { getAuthContext } from "@/lib/api/auth-context";
import { ok, handleError } from "@/lib/api/response";
import { readCrmJson } from "@/lib/api/crm-wire";
import { getPipeline, updatePipeline, deletePipeline } from "@/lib/api/crm";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getAuthContext(request);
    const { id } = await params;
    return ok({ pipeline: await getPipeline(ctx, id) });
  } catch (err) { return handleError(err); }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getAuthContext(request);
    const { id } = await params;
    return ok({ pipeline: await updatePipeline(ctx, id, await readCrmJson(request), request) });
  } catch (err) { return handleError(err); }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getAuthContext(request);
    const { id } = await params;
    return ok(await deletePipeline(ctx, id, request));
  } catch (err) { return handleError(err); }
}
