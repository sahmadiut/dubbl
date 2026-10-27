import { z } from "zod";
import { AuthError, getAuthContext } from "@/lib/api/auth-context";
import { jsonResponse } from "@/lib/api/json-response";
import { handleError } from "@/lib/api/response";
import { rotateProviderCredential, revokeProviderCredential, versionSchema, credentialSchema } from "@/lib/ai/providers";
type Context = { params: Promise<{ id: string }> };
async function credentialBody(request: Request): Promise<unknown> {
  // JSON parser diagnostics can contain the raw credential-bearing request.
  try { return await request.json(); }
  catch { throw new AuthError("Invalid JSON body", 400); }
}
export async function PUT(request: Request, context: Context) {
  try { const ctx = await getAuthContext(request), input = z.object({ expectedVersion: versionSchema, secret: credentialSchema }).strict().parse(await credentialBody(request)); return jsonResponse(await rotateProviderCredential(ctx, (await context.params).id, input.expectedVersion, input.secret)); } catch (err) { return handleError(err); }
}
export async function DELETE(request: Request, context: Context) {
  try { const ctx = await getAuthContext(request), input = z.object({ expectedVersion: versionSchema }).strict().parse(await credentialBody(request)); return jsonResponse(await revokeProviderCredential(ctx, (await context.params).id, input.expectedVersion)); } catch (err) { return handleError(err); }
}
