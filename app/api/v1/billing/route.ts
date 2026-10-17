import { getAuthContext } from "@/lib/api/auth-context";
import { ok, handleError } from "@/lib/api/response";
import { readBillingSettings } from "@/lib/api/billing-settings";

export async function GET(request: Request) {
  try { return ok(await readBillingSettings(await getAuthContext(request))); }
  catch (err) { return handleError(err); }
}
