import { jsonResponse } from "@/lib/api/json-response";
import { db } from "@/lib/db";
import { exchangeRate } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getAuthContext } from "@/lib/api/auth-context";
import { requireRole } from "@/lib/api/require-role";
import { handleError, notFound } from "@/lib/api/response";
import { coexistRateSchema, manualWireRateSchema, storedRateDto } from "@/lib/currency/rate-wire";
import { manualProviderMetadata } from "@/lib/currency/rate-input";
import { logAudit, diffChanges } from "@/lib/api/audit";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const ctx = await getAuthContext(request);
    requireRole(ctx, "manage:tax-config");

    const body = await request.json();
    const parsed = coexistRateSchema.parse(body);

    const existing = await db.query.exchangeRate.findFirst({
      where: and(
        eq(exchangeRate.id, id),
        eq(exchangeRate.organizationId, ctx.organizationId)
      ),
    });

    if (!existing) return notFound("Exchange rate");
    manualWireRateSchema.parse({ ...parsed, baseCurrency: existing.baseCurrency,
      targetCurrency: existing.targetCurrency, date: existing.date });

    // Editing a rate by hand makes it a manual override: pin source so it both
    // wins over and is protected from the automatic daily sync.
    const [updated] = await db
      .update(exchangeRate)
      .set({ rate: parsed.rate, rateExact: parsed.rateExact, source: "manual", ...manualProviderMetadata })
      .where(and(eq(exchangeRate.id, id), eq(exchangeRate.organizationId, ctx.organizationId)))
      .returning();

    if (!updated) return notFound("Exchange rate");
    await logAudit({ ctx, action: "update", entityType: "exchange_rate", entityId: id,
      changes: diffChanges(existing, updated), request });
    return jsonResponse({ exchangeRate: storedRateDto(updated) });
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const ctx = await getAuthContext(request);
    requireRole(ctx, "manage:tax-config");

    const existing = await db.query.exchangeRate.findFirst({
      where: and(
        eq(exchangeRate.id, id),
        eq(exchangeRate.organizationId, ctx.organizationId)
      ),
    });

    if (!existing) return notFound("Exchange rate");

    await db.delete(exchangeRate).where(and(eq(exchangeRate.id, id), eq(exchangeRate.organizationId, ctx.organizationId)));
    await logAudit({ ctx, action: "delete", entityType: "exchange_rate", entityId: id, request });

    return jsonResponse({ success: true });
  } catch (err) {
    return handleError(err);
  }
}
