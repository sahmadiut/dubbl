import { getAuthContext } from "@/lib/api/auth-context";
import { ok, error, handleError } from "@/lib/api/response";
import { createBillingPortal } from "@/lib/api/billing-settings";
import { stripe } from "@/lib/stripe";

export async function POST(request: Request) {
  if (!stripe) return error("Billing not configured", 404);
  try { return ok(await createBillingPortal(await getAuthContext(request))); }
  catch (err) { return handleError(err); }
}
