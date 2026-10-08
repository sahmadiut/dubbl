import { jsonResponse } from "@/lib/api/json-response";
import { stripeOperationSchema } from "@/lib/integrations/stripe/money";
import { db } from "@/lib/db";
import { stripeIntegration } from "@/lib/db/schema";
import { getAuthContext } from "@/lib/api/auth-context";
import { requireRole } from "@/lib/api/require-role";
import { handleError, notFound } from "@/lib/api/response";
import { eq, and } from "drizzle-orm";
import { notDeleted } from "@/lib/db/soft-delete";
import { reconcileStripeBalance } from "@/lib/integrations/stripe/reconcile";

export async function POST(request: Request) {
  try {
    const ctx = await getAuthContext(request);
    requireRole(ctx, "manage:integrations");

    const body = stripeOperationSchema.parse(await request.json());
    const integrationId = body.integrationId;
    if (!integrationId) {
      return jsonResponse({ error: "integrationId is required" }, { status: 400 });
    }

    const integration = await db.query.stripeIntegration.findFirst({
      where: and(
        eq(stripeIntegration.id, integrationId),
        eq(stripeIntegration.organizationId, ctx.organizationId),
        notDeleted(stripeIntegration.deletedAt)
      ),
    });

    if (!integration) return notFound("Stripe integration");

    const days = body.days;

    const result = await reconcileStripeBalance(
      integration.id,
      ctx.organizationId,
      days
    );

    return jsonResponse({ success: true, ...result });
  } catch (err) {
    return handleError(err);
  }
}
