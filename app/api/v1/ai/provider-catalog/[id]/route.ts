import { z } from "zod";
import { getAuthContext } from "@/lib/api/auth-context";
import { jsonResponse } from "@/lib/api/json-response";
import { handleError } from "@/lib/api/response";
import { saveProvider, providerSchema, versionSchema } from "@/lib/ai/providers";
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try { const ctx = await getAuthContext(request), input = z.object({ expectedVersion: versionSchema, configuration: providerSchema }).strict().parse(await request.json()); return jsonResponse(await saveProvider(ctx, input.configuration, (await context.params).id, input.expectedVersion)); } catch (err) { return handleError(err); }
}
