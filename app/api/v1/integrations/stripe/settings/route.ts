import { getAuthContext } from "@/lib/api/auth-context";
import { ok, handleError } from "@/lib/api/response";
import { updateStripeSettings } from "@/lib/api/stripe-settings";

export async function PATCH(request: Request) {
  try { return ok(await updateStripeSettings(await getAuthContext(request), await request.json())); }
  catch (err) { return handleError(err); }
}
