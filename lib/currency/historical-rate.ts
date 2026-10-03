import { and, desc, eq, lte } from "drizzle-orm";
import { db } from "@/lib/db";
import { exchangeRate } from "@/lib/db/schema";
import { currencyCodeSchema } from "./zod";
import { divideRates, isoRateDate } from "./rate-policy";
import { exactRate, toLegacyRate } from "./exact-rate";

export interface HistoricalRate {
  rate: number;
  rateExact: string;
  effectiveDate: string;
  source: "same" | "manual" | "api";
  inverse: boolean;
  provider: string | null;
  providerObservedAt: string | null;
  importedAt: string | null;
}

/** Create per request/batch, after authorization. No tenant rows in global caches.
 * Both requested as-of and resolved effective-date keys include tenant/base/quote.
 * A new resolver observes subsequent writes; a batch keeps a consistent cached quote.
 */
export function createHistoricalRateResolver(orgId: string, database: Pick<typeof db, "query"> = db) {
  if (!orgId) throw new TypeError("Organization is required for rate lookup");
  const requests = new Map<string, Promise<Readonly<HistoricalRate> | null>>();
  const effective = new Map<string, Readonly<HistoricalRate>>();
  async function resolve(base: string, quote: string, asOf: string): Promise<Readonly<HistoricalRate> | null> {
    if (base === quote) return Object.freeze({ rate: 1000000, rateExact: "1", effectiveDate: asOf,
      source: "same", inverse: false, provider: null, providerObservedAt: null, importedAt: null });
    const lookup = (from: string, to: string) => database.query.exchangeRate.findFirst({
      where: and(eq(exchangeRate.organizationId, orgId), eq(exchangeRate.baseCurrency, from),
        eq(exchangeRate.targetCurrency, to), lte(exchangeRate.date, asOf)), orderBy: desc(exchangeRate.date),
    });
    let row = await lookup(base, quote), inverse = false;
    if (!row) { row = await lookup(quote, base); inverse = true; }
    // Quarantined rows cannot become an authoritative rate or a fake 1:1 fallback.
    if (!row || row.rateMigrationStatus !== "exact" || !row.rateExact ||
        row.rateFormatVersion !== 1 || row.rateDirection !== "quote_per_base") return null;
    const key = JSON.stringify([orgId, base, quote, row.date, row.id, inverse]);
    if (effective.has(key)) return effective.get(key)!;
    let rateExact: string, rate: number;
    try {
      rateExact = inverse ? divideRates("1", row.rateExact) : exactRate(row.rateExact);
      rate = inverse ? toLegacyRate(divideRates("1", row.rateExact, 6)) : row.rate;
    } catch { return null; }
    const result = Object.freeze({ rate, rateExact, effectiveDate: row.date, source: row.source, inverse,
      provider: row.provider, providerObservedAt: row.providerObservedAt?.toISOString() ?? null,
      importedAt: row.importedAt?.toISOString() ?? null });
    effective.set(key, result);
    return result;
  }
  return (baseInput: string, quoteInput: string, asOfInput: string) => {
    const base = currencyCodeSchema.parse(baseInput), quote = currencyCodeSchema.parse(quoteInput);
    const asOf = isoRateDate(asOfInput), key = JSON.stringify([orgId, base, quote, asOf]);
    if (!requests.has(key)) {
      const pending = resolve(base, quote, asOf).catch(error => { requests.delete(key); throw error; });
      requests.set(key, pending);
    }
    return requests.get(key)!;
  };
}
