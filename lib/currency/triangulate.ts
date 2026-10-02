import { isValidCurrencyCode } from "./iso4217";
import { divideRates, providerDecimal } from "./rate-policy";
import { toLegacyRate } from "./exact-rate";

export interface DerivedRate { targetCurrency: string; rate: number }
export interface ProviderQuote {
  targetCurrency: string;
  /** Original direct decimal, or cross quote half-up at 18 places. */
  quote: string | null;
  /** Legacy six-place quote, rounded directly from the rational (no double rounding). */
  legacyQuote: string | null;
}

export function deriveProviderQuotes(feed: { base: string; rates: Record<string, string> }, base: string): ProviderQuote[] {
  const denominator = feed.base === base ? "1" : feed.rates[base];
  if (!denominator) return [];
  const quotes = { ...feed.rates, [feed.base]: "1" };
  return Object.entries(quotes).flatMap(([code, value]) => {
    if (code === base || !isValidCurrencyCode(code)) return [];
    let quote: string | null;
    try { quote = divideRates(value, denominator); } catch { quote = null; }
    let legacyQuote: string | null;
    try { legacyQuote = divideRates(value, denominator, 6); } catch { legacyQuote = null; }
    return [{ targetCurrency: code, quote, legacyQuote }];
  });
}

/** Compatibility helper for existing numeric feeds; live ingestion uses exact strings. */
export function deriveRates(feed: { base: string; rates: Record<string, number> }, base: string): DerivedRate[] {
  const rates: Record<string, string> = {};
  for (const [code, value] of Object.entries(feed.rates)) {
    try { rates[code.toUpperCase()] = providerDecimal(String(value)); } catch { /* invalid quote */ }
  }
  return deriveProviderQuotes({ base: feed.base.toUpperCase(), rates }, base.toUpperCase()).flatMap(row => {
    try { return [{ targetCurrency: row.targetCurrency, rate: toLegacyRate(row.legacyQuote!) }]; } catch { return []; }
  });
}
