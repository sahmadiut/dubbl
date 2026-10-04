import { getAuthContext } from "@/lib/api/auth-context";
import { ok, handleError } from "@/lib/api/response";
import { buildAssembly } from "@/lib/api/inventory-assembly";
import { readAssemblyBuild } from "@/lib/api/inventory-assembly-wire";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await getAuthContext(request);
    return ok(await buildAssembly(ctx, id, await readAssemblyBuild(request), request));
  } catch (err) { return handleError(err); }
}
