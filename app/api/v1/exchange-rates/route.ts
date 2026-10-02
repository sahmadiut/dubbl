import { jsonResponse } from "@/lib/api/json-response";
import { db } from "@/lib/db";
import { exchangeRate } from "@/lib/db/schema";
import { eq, and, gte, lte, desc, sql } from "drizzle-orm";
import { getAuthContext } from "@/lib/api/auth-context";
import { requireRole } from "@/lib/api/require-role";
import { handleError } from "@/lib/api/response";
import { logAudit } from "@/lib/api/audit";
import { parsePagination, paginatedResponse } from "@/lib/api/pagination";
import { manualProviderMetadata } from "@/lib/currency/rate-input";
import { manualWireRateSchema, storedRateDto } from "@/lib/currency/rate-wire";
import { rateDateSchema } from "@/lib/currency/rate-policy";
import { currencyCodeSchema } from "@/lib/currency/zod";
import { z } from "zod";

const createSchema = z.object({
  rates: z.array(manualWireRateSchema).min(1).max(500),
});

export async function GET(request: Request) {
  try {
    const ctx = await getAuthContext(request);
    const url = new URL(request.url);
    const { page, limit, offset } = parsePagination(url);

    const startDate = url.searchParams.get("startDate");
    const endDate = url.searchParams.get("endDate");
    const baseCurrency = url.searchParams.get("baseCurrency");
    const targetCurrency = url.searchParams.get("targetCurrency");

    const conditions = [eq(exchangeRate.organizationId, ctx.organizationId)];

    if (startDate) {
      conditions.push(gte(exchangeRate.date, rateDateSchema.parse(startDate)));
    }
    if (endDate) {
      conditions.push(lte(exchangeRate.date, rateDateSchema.parse(endDate)));
    }
    if (baseCurrency) {
      conditions.push(eq(exchangeRate.baseCurrency, currencyCodeSchema.parse(baseCurrency)));
    }
    if (targetCurrency) {
      conditions.push(eq(exchangeRate.targetCurrency, currencyCodeSchema.parse(targetCurrency)));
    }

    const where = and(...conditions);

    const rates = await db.query.exchangeRate.findMany({
      where,
      orderBy: desc(exchangeRate.date),
      limit,
      offset,
    });

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(exchangeRate)
      .where(where);

    return jsonResponse(paginatedResponse(rates.map(storedRateDto), count, page, limit));
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await getAuthContext(request);
    requireRole(ctx, "manage:tax-config");

    const body = await request.json();
    const parsed = createSchema.parse(body);

    const values = parsed.rates.map((r) => ({
      organizationId: ctx.organizationId,
      baseCurrency: r.baseCurrency,
      targetCurrency: r.targetCurrency,
      rate: r.rate,
      rateExact: r.rateExact,
      date: r.date,
      source: "manual" as const,
      ...manualProviderMetadata,
    }));

    const created = await db
      .insert(exchangeRate)
      .values(values)
      .onConflictDoUpdate({
        target: [
          exchangeRate.organizationId,
          exchangeRate.baseCurrency,
          exchangeRate.targetCurrency,
          exchangeRate.date,
        ],
        set: {
          rate: sql`excluded.rate`,
          rateExact: sql`excluded.rate_exact`,
          source: sql`excluded.source`,
          ...manualProviderMetadata,
        },
      })
      .returning();

    for (const rate of created) {
      await logAudit({ ctx, action: "create", entityType: "exchange_rate", entityId: rate.id, request });
    }

    return jsonResponse({ exchangeRates: created.map(storedRateDto) }, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}
