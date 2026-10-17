import { z } from "zod";
import { getAuthContext } from "@/lib/api/auth-context";
import { getLocalePreferences, updateLocalePreferences } from "@/lib/api/locale-preferences";
import { handleError, ok } from "@/lib/api/response";

export async function GET(request: Request) {
  try { return ok(await getLocalePreferences(await getAuthContext(request))); }
  catch (error) { return handleError(error); }
}
export async function PATCH(request: Request) {
  try {
    const ctx = await getAuthContext(request);
    let body: unknown;
    try { body = await request.json(); } catch {
      throw new z.ZodError([{ code: "custom", path: [], message: "Invalid JSON preferences body" }]);
    }
    return ok(await updateLocalePreferences(ctx, body));
  } catch (error) { return handleError(error); }
}
