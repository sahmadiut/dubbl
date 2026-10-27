import { z } from "zod";
import { getAuthContext } from "@/lib/api/auth-context";
import { jsonResponse } from "@/lib/api/json-response";
import { handleError } from "@/lib/api/response";
import { listProviderConfigs, saveProviderConfig, configSchema, providerIdSchema, versionSchema } from "@/lib/ai/providers";
export async function GET(request: Request) {
  try { return jsonResponse({ configurations: await listProviderConfigs(await getAuthContext(request)) }); } catch (err) { return handleError(err); }
}
export async function POST(request: Request) {
  try { const ctx = await getAuthContext(request), input = z.object({ providerId: providerIdSchema, expectedVersion: versionSchema.optional(), configuration: configSchema }).strict().parse(await request.json()); return jsonResponse(await saveProviderConfig(ctx, input.providerId, input.configuration, input.expectedVersion)); } catch (err) { return handleError(err); }
}
