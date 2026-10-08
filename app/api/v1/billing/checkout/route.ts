import { getAuthContext } from "@/lib/api/auth-context";
import { handleError, ok } from "@/lib/api/response";
import { createBillingCheckout } from "@/lib/integrations/stripe/billing";

export async function POST(request: Request) {
  try {
    const ctx = await getAuthContext(request);
    return ok(await createBillingCheckout(ctx, await request.json()));
  } catch (err) { return handleError(err); }
}
