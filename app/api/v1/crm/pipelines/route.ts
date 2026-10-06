import { getAuthContext } from "@/lib/api/auth-context";
import { ok, created, handleError } from "@/lib/api/response";
import { readCrmJson } from "@/lib/api/crm-wire";
import { listPipelines, createPipeline } from "@/lib/api/crm";

export async function GET(request: Request) {
  try {
    const ctx = await getAuthContext(request);
    return ok({ pipelines: await listPipelines(ctx) });
  } catch (err) { return handleError(err); }
}

export async function POST(request: Request) {
  try {
    const ctx = await getAuthContext(request);
    return created({ pipeline: await createPipeline(ctx, await readCrmJson(request), request) });
  } catch (err) { return handleError(err); }
}
