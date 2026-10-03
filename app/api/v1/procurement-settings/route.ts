import { getAuthContext, AuthError } from "@/lib/api/auth-context";
import { requireRole } from "@/lib/api/require-role";
import { handleError, ok } from "@/lib/api/response";
import { readProcurementSettings, updateProcurementSettings } from "@/lib/api/procurement-settings";

export async function GET(request: Request) {
  try {
    return ok(await readProcurementSettings(await getAuthContext(request)));
  } catch (err) {
    return handleError(err);
  }
}

/** Partial upsert; PUT remains supported for the existing settings UI/clients. */
export async function PATCH(request: Request) {
  try {
    const ctx = await getAuthContext(request);
    requireRole(ctx, "manage:bills");
    const input = await request.json().catch(() => { throw new AuthError("Invalid JSON body", 400); });
    return ok(await updateProcurementSettings(ctx, input, request));
  } catch (err) {
    return handleError(err);
  }
}

export const PUT = PATCH;
