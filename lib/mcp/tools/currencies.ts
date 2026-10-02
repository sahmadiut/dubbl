import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { db } from "@/lib/db";
import { currency, exchangeRate } from "@/lib/db/schema";
import { and, eq, gte, lte, desc, ilike, or, sql } from "drizzle-orm";
import { requireRole } from "@/lib/api/require-role";
import { wrapTool } from "@/lib/mcp/errors";
import { ensureCurrencies } from "@/lib/currency/ensure-currencies";
import { currencyCodeSchema } from "@/lib/currency/zod";
import { getExchangeRate, convertAmount } from "@/lib/currency/converter";
import { manualProviderMetadata } from "@/lib/currency/rate-input";
import { manualWireRateSchema, mcpRateFields, mcpWireRateSchema, storedRateDto } from "@/lib/currency/rate-wire";
import { legacyMinorSchema, legacyMinor, WireCompatibilityError } from "@/lib/money/wire";
import { currencyMetadata } from "@/lib/money/exact";
import { createHistoricalRateResolver } from "@/lib/currency/historical-rate";
import { rateDateSchema } from "@/lib/currency/rate-policy";
import { logAudit } from "@/lib/api/audit";
import type { AuthContext } from "@/lib/api/auth-context";

const RATE_SCALE = 1_000_000; // exchangeRate.rate is an integer with 6 decimals

export function registerCurrencyTools(server: McpServer, ctx: AuthContext) {
  server.tool(
    "list_currencies",
    "List the available ISO 4217 currencies (code, name, symbol, and decimal places / minor units). Use the `code` value when setting a currency on any record.",
    {
      search: z
        .string()
        .optional()
        .describe("Optional case-insensitive filter on currency code or name"),
    },
    (params) =>
      wrapTool(ctx, async () => {
        await ensureCurrencies();
        const where = params.search
          ? or(
              ilike(currency.code, `%${params.search}%`),
              ilike(currency.name, `%${params.search}%`)
            )
          : undefined;
        const currencies = await db.query.currency.findMany({
          where,
          orderBy: currency.code,
        });
        return { currencies };
      })
  );

  server.tool(
    "list_exchange_rates",
    "List stored organization rates, in quote units per base unit. `rate` is integer millionths and `rateDecimal` is numeric. `rateExact` is the stored exact decimal when rateMigrationStatus is exact. Provider identity, pre-6dp providerQuote, source observation/import UTC timestamps and explicit rounding are included; old/manual rows have null provider metadata.",
    {
      baseCurrency: currencyCodeSchema.optional().describe("Filter by base currency code"),
      targetCurrency: currencyCodeSchema.optional().describe("Filter by target currency code"),
      startDate: rateDateSchema.optional().describe("Earliest Gregorian rate date (YYYY-MM-DD)"),
      endDate: rateDateSchema.optional().describe("Latest Gregorian rate date (YYYY-MM-DD)"),
      limit: z.number().int().min(1).max(200).optional().default(50).describe("Max rows (max 200)"),
    },
    (params) =>
      wrapTool(ctx, async () => {
        const conditions = [eq(exchangeRate.organizationId, ctx.organizationId)];
        if (params.baseCurrency) conditions.push(eq(exchangeRate.baseCurrency, params.baseCurrency));
        if (params.targetCurrency) conditions.push(eq(exchangeRate.targetCurrency, params.targetCurrency));
        if (params.startDate) conditions.push(gte(exchangeRate.date, params.startDate));
        if (params.endDate) conditions.push(lte(exchangeRate.date, params.endDate));

        const rates = await db.query.exchangeRate.findMany({
          where: and(...conditions),
          orderBy: desc(exchangeRate.date),
          limit: params.limit,
        });
        return {
          rates: rates.map((r) => ({ ...storedRateDto(r), rateDecimal: r.rate / RATE_SCALE })),
        };
      })
  );

  server.tool(
    "get_exchange_rate",
    "Get the organization's historical quote on or before a Gregorian date, with inverse fallback. Missing/quarantined/unrepresentable rates return null aliases. rate is legacy integer millionths (inverse half-up at 6 places); rateExact is a quote-per-base decimal string (inverse half-up at 18 places), so inverse aliases may differ in precision. Includes effective date, source and provider UTC timestamps. Existing posted transactions retain their saved rates.",
    {
      baseCurrency: currencyCodeSchema.describe("Base currency code (the 'from' currency)"),
      targetCurrency: currencyCodeSchema.describe("Target currency code (the 'to' currency)"),
      date: rateDateSchema.describe("As-of Gregorian YYYY-MM-DD; latest stored rate on or before this date"),
    },
    (params) =>
      wrapTool(ctx, async () => {
        const resolved = await createHistoricalRateResolver(ctx.organizationId)(
          params.baseCurrency,
          params.targetCurrency,
          params.date
        );
        const rate = resolved?.rate ?? null;
        return {
          ...resolved,
          baseCurrency: params.baseCurrency,
          targetCurrency: params.targetCurrency,
          date: params.date,
          rate,
          rateExact: resolved?.rateExact ?? null,
          rateDirection: "quote_per_base",
          rateDecimal: rate === null ? null : rate / RATE_SCALE,
        };
      })
  );

  server.tool(
    "convert_amount",
    "Legacy conversion preview using the organization's scaled historical rate. Input/output are safe integer minor-unit numbers (e.g. USD 1250 = $12.50); product must also fit a safe integer. Retains v1 equal-scale arithmetic and ties toward positive infinity. Exact-string amounts and conversion between different minor-unit scales await domain cutover; do not use this preview for those pairs.",
    {
      amountMinorUnits: legacyMinorSchema.describe("Safe integer minor-unit amount; no exact-string alias in this legacy preview"),
      fromCurrency: currencyCodeSchema.describe("Source currency code"),
      toCurrency: currencyCodeSchema.describe("Destination currency code"),
      date: rateDateSchema.describe("As-of Gregorian YYYY-MM-DD for the rate"),
    },
    (params) =>
      wrapTool(ctx, async () => {
        const amount = legacyMinorSchema.parse(params.amountMinorUnits);
        if (currencyMetadata(params.fromCurrency).minorUnits !== currencyMetadata(params.toCurrency).minorUnits) {
          throw new WireCompatibilityError("Legacy conversion preview requires matching currency minor-unit scales; exact domain conversion is not available yet");
        }
        const rate = await getExchangeRate(
          ctx.organizationId,
          params.fromCurrency,
          params.toCurrency,
          params.date
        );
        if (rate === null) {
          throw new Error(
            `No exchange rate available for ${params.fromCurrency}->${params.toCurrency} on or before ${params.date}`
          );
        }
        // Guard before Number multiplication, rather than stringifying lost precision.
        const product = BigInt(amount) * BigInt(rate);
        if (product < BigInt(Number.MIN_SAFE_INTEGER) || product > BigInt(Number.MAX_SAFE_INTEGER)) {
          throw new WireCompatibilityError();
        }
        const converted = legacyMinor(BigInt(convertAmount(amount, rate)));
        return {
          fromCurrency: params.fromCurrency,
          toCurrency: params.toCurrency,
          date: params.date,
          rate,
          rateDecimal: rate / RATE_SCALE,
          amountMinorUnits: params.amountMinorUnits,
          convertedMinorUnits: converted,
        };
      })
  );

  server.tool(
    "set_exchange_rate",
    "Create or update a manual organization rate (requires manage:tax-config). Provide rateExact as a quote-per-base ASCII decimal string, legacy unscaled numeric rateDecimal, or agreeing aliases. Coexistence requires at most 6 decimals and maximum 2147.483647; unsupported exact rates fail with LEGACY_NUMERIC_RANGE before writes. Returns the saved integer-millionths rate, numeric rateDecimal, rateExact, direction and provenance. Manual overrides clear provider metadata and take precedence for the same day.",
    {
      baseCurrency: currencyCodeSchema.describe("Base currency code (the 'from' currency)"),
      targetCurrency: currencyCodeSchema.describe("Target currency code (the 'to' currency)"),
      ...mcpRateFields,
      date: rateDateSchema.describe("Effective Gregorian YYYY-MM-DD date"),
    },
    (params) =>
      wrapTool(ctx, async () => {
        requireRole(ctx, "manage:tax-config");
        const aliases = mcpWireRateSchema.parse(params);
        const input = manualWireRateSchema.parse({ ...params, ...aliases });
        const [saved] = await db
          .insert(exchangeRate)
          .values({
            organizationId: ctx.organizationId,
            baseCurrency: input.baseCurrency,
            targetCurrency: input.targetCurrency,
            rate: input.rate,
            rateExact: input.rateExact,
            date: input.date,
            source: "manual",
            ...manualProviderMetadata,
          })
          .onConflictDoUpdate({
            target: [
              exchangeRate.organizationId,
              exchangeRate.baseCurrency,
              exchangeRate.targetCurrency,
              exchangeRate.date,
            ],
            set: { rate: sql`excluded.rate`, rateExact: sql`excluded.rate_exact`, source: sql`excluded.source`, ...manualProviderMetadata },
          })
          .returning();
        await logAudit({ ctx, action: "create", entityType: "exchange_rate", entityId: saved.id });
        return { exchangeRate: { ...storedRateDto(saved), rateDecimal: saved.rate / RATE_SCALE } };
      })
  );

  server.tool(
    "delete_exchange_rate",
    "Delete a stored exchange rate by its id (requires the manage:tax-config role). Only deletes rates belonging to the organization. Returns { success: true } on success; errors if no matching rate exists.",
    {
      id: z.string().describe("The exchange rate's id (UUID) to delete"),
    },
    (params) =>
      wrapTool(ctx, async () => {
        requireRole(ctx, "manage:tax-config");
        const existing = await db.query.exchangeRate.findFirst({
          where: and(
            eq(exchangeRate.id, params.id),
            eq(exchangeRate.organizationId, ctx.organizationId)
          ),
        });
        if (!existing) {
          throw new Error(`Exchange rate not found: ${params.id}`);
        }
        await db.delete(exchangeRate).where(and(eq(exchangeRate.id, params.id), eq(exchangeRate.organizationId, ctx.organizationId)));
        await logAudit({ ctx, action: "delete", entityType: "exchange_rate", entityId: params.id });
        return { success: true };
      })
  );
}
