import { currencyMetadata, roundRatio } from "@/lib/money/exact";
import { legacyMinor, WireCompatibilityError } from "@/lib/money/wire";
import { fromLegacyRate, FX_DIRECTION } from "@/lib/currency/exact-rate";
import type { RateStatus } from "@/lib/currency/rate-status";

function safeMinor(value: bigint) {
  const limit = BigInt(Number.MAX_SAFE_INTEGER);
  if (value < -limit || value > limit) throw new WireCompatibilityError();
  return legacyMinor(value);
}

/** Issue-date display lookup, not a document's persisted posting FX. */
export function documentBaseDto(currencyCode: string, baseCurrency: string,
  amounts: { subtotal: number; taxTotal: number; total: number; amountPaid: number; amountDue: number }, status: RateStatus) {
  const rate = status.rate;
  const converted: Record<string, number | string | null> = {};
  if (rate !== null && (!Number.isSafeInteger(rate) || rate <= 0 || rate > 2147483647)) {
    throw new WireCompatibilityError("Document display rate is outside positive int32 millionths");
  }
  if (rate !== null && currencyMetadata(currencyCode).minorUnits !== currencyMetadata(baseCurrency).minorUnits) {
    throw new WireCompatibilityError("Legacy document base display requires matching currency scales");
  }
  for (const [key, amount] of Object.entries(amounts)) {
    if (!Number.isSafeInteger(amount)) throw new WireCompatibilityError();
    if (rate === null) { converted[key] = null; converted[`${key}Minor`] = null; continue; }
    const product = BigInt(amount) * BigInt(rate);
    // Identity avoids multiplying a Number; nonidentity retains the legacy product guard.
    if (rate !== 1000000) safeMinor(product);
    // Preserve Math.round's signed tie toward positive infinity using integer ratios.
    const result = rate === 1000000 ? BigInt(amount) : roundRatio(2n * product + 1000000n, 2000000n, "floor");
    converted[key] = safeMinor(result); converted[`${key}Minor`] = result.toString();
  }
  return { baseCurrency, rate, rateExact: rate === null ? null : fromLegacyRate(rate),
    rateDirection: FX_DIRECTION, rateBasis: "historical_lookup_millionths", amounts: converted, status };
}
