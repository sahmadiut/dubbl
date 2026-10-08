import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { stripeIntegration } from "@/lib/db/schema";
import { getAuthContext } from "@/lib/api/auth-context";
import { requireRole } from "@/lib/api/require-role";
import { handleError, notFound } from "@/lib/api/response";
import { eq, and } from "drizzle-orm";
import { notDeleted } from "@/lib/db/soft-delete";
import { importStripeCsv } from "@/lib/integrations/stripe/import";
import { z } from "zod";

export async function POST(request: Request) {
  try {
    const ctx = await getAuthContext(request);
    requireRole(ctx, "manage:integrations");

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const type = formData.get("type") as string | null;
    const integrationId = formData.get("integrationId") as string | null;

    if (!integrationId) {
      return NextResponse.json({ error: "integrationId is required" }, { status: 400 });
    }

    z.string().uuid().parse(integrationId);
    const integration = await db.query.stripeIntegration.findFirst({
      where: and(
        eq(stripeIntegration.id, integrationId),
        eq(stripeIntegration.organizationId, ctx.organizationId),
        notDeleted(stripeIntegration.deletedAt)
      ),
    });

    if (!integration) return notFound("Stripe integration");

    if (!file) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }
    if (!type || !["payments", "payouts"].includes(type)) {
      return NextResponse.json(
        { error: "type must be 'payments' or 'payouts'" },
        { status: 400 }
      );
    }

    const result = await importStripeCsv(integration, await file.text(), type);
    return NextResponse.json(result);
  } catch (err) {
    return handleError(err);
  }
}
