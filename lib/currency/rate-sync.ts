import { and, desc, eq, lte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { exchangeRate, organization } from "@/lib/db/schema";
import { getRateProvider, validateRateFeed, type RateFeed, type RateProvider } from "./rate-provider";
import { deriveProviderQuotes } from "./triangulate";
import { fromLegacyRate } from "./exact-rate";
import { isExtremeRateChange, legacyProviderRate } from "./rate-policy";

type SyncOptions = { database?: typeof db; provider?: RateProvider; now?: Date };

/** Refresh quote rows only. Posted journal/document snapshots are never updated.
 * Public provider feeds may be shared within this invocation; tenant quotes may not.
 */
export async function processExchangeRateSync(options: SyncOptions = {}) {
  const database = options.database ?? db, provider = options.provider ?? getRateProvider();
  const now = options.now ?? new Date();
  const orgs = await database.select({ id: organization.id, base: organization.defaultCurrency }).from(organization);
  const groups = new Map<string, string[]>();
  for (const org of orgs) {
    const base = (org.base || "USD").toUpperCase();
    groups.set(base, [...(groups.get(base) ?? []), org.id]);
  }
  // Invocation-local public data, keyed by provider/actual base/effective date.
  const feeds = new Map<string, RateFeed>();
  const result = { bases: 0, upserts: 0, failedBases: 0, rejectedExtreme: 0, rejectedCompatibility: 0, skipped: 0 };
  for (const [base, orgIds] of groups) {
    let feed = [...feeds.values()].find(f => f.base === base || f.rates[base]);
    if (!feed) {
      try {
        feed = validateRateFeed(await provider.fetchRates(base), now);
        if (feed.provider !== provider.name) throw new TypeError("Provider identity mismatch");
        feeds.set(JSON.stringify([feed.provider, feed.base, feed.date]), feed);
      } catch {
        result.failedBases++;
        // Never log raw errors: fetch errors can contain paid-provider credentials.
        console.warn("rate-sync: provider unavailable or invalid; base skipped");
        continue;
      }
    }
    const rows = deriveProviderQuotes(feed, base);
    if (!rows.length) { result.failedBases++; continue; }
    result.bases++;
    const currentFeed = feed;
    for (const orgId of orgIds) {
      const counts = await database.transaction(async tx => {
        // Serialize refreshes for this tenant/base, including the initial empty-row case.
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${orgId}), hashtext(${base}))`);
        const counts = { upserts: 0, rejectedExtreme: 0, rejectedCompatibility: 0, skipped: 0 };
        for (const row of rows) {
          if (!row.quote) { counts.rejectedCompatibility++; continue; }
          let rate: number;
          try { rate = legacyProviderRate(row.quote, row.legacyQuote); } catch { counts.rejectedCompatibility++; continue; }
          const previous = await tx.query.exchangeRate.findFirst({
            where: and(eq(exchangeRate.organizationId, orgId), eq(exchangeRate.baseCurrency, base),
              eq(exchangeRate.targetCurrency, row.targetCurrency), lte(exchangeRate.date, currentFeed.date)),
            orderBy: desc(exchangeRate.date),
          });
          if (previous?.date === currentFeed.date && (previous.source === "manual" ||
              (previous.providerObservedAt && currentFeed.observedAt && previous.providerObservedAt.toISOString() > currentFeed.observedAt))) {
            counts.skipped++; continue;
          }
          if (previous && (previous.rateMigrationStatus !== "exact" || !previous.rateExact ||
              isExtremeRateChange(previous.rateExact, row.quote))) {
            counts.rejectedExtreme++; continue;
          }
          const saved = await tx.insert(exchangeRate).values({
            organizationId: orgId, baseCurrency: base, targetCurrency: row.targetCurrency,
            rate, rateExact: fromLegacyRate(rate), date: currentFeed.date, source: "api",
            provider: currentFeed.provider, providerBase: currentFeed.base, providerQuote: row.quote,
            providerObservedAt: currentFeed.observedAt ? new Date(currentFeed.observedAt) : null,
            importedAt: now, providerRounding: "half_up_6",
          }).onConflictDoUpdate({
            target: [exchangeRate.organizationId, exchangeRate.baseCurrency, exchangeRate.targetCurrency, exchangeRate.date],
            set: { rate: sql`excluded.rate`, rateExact: sql`excluded.rate_exact`, source: sql`excluded.source`,
              provider: sql`excluded.provider`, providerBase: sql`excluded.provider_base`, providerQuote: sql`excluded.provider_quote`,
              providerObservedAt: sql`excluded.provider_observed_at`, importedAt: sql`excluded.imported_at`, providerRounding: sql`excluded.provider_rounding` },
            setWhere: sql`${exchangeRate.source} <> 'manual'`,
          }).returning({ id: exchangeRate.id });
          counts.upserts += saved.length;
          counts.skipped += saved.length ? 0 : 1;
        }
        return counts;
      });
      for (const key of ["upserts", "rejectedExtreme", "rejectedCompatibility", "skipped"] as const) result[key] += counts[key];
    }
  }
  return result;
}
