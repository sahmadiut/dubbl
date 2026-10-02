import { createHistoricalRateResolver } from "./historical-rate";

/**
 * Thrown when a foreign-currency document must be converted to the base
 * currency but no exchange rate is available. Posting at a fake 1:1 would put
 * wrong numbers in the ledger, so callers surface this and prompt the user to
 * enter a custom rate instead. Mapped to HTTP 422 in lib/api/response.ts.
 */
export class MissingExchangeRateError extends Error {
  constructor(
    public from: string,
    public to: string,
    public date: string
  ) {
    super(
      `No exchange rate for ${from}→${to} on ${date}. Add one under ` +
        `Settings → Currencies (rates also sync automatically each day).`
    );
    this.name = "MissingExchangeRateError";
  }
}

/**
 * Get exchange rate for a currency pair on or before a given date.
 * Returns rate as integer (6 decimal places, 1000000 = 1.0)
 */
export async function getExchangeRate(
  orgId: string,
  baseCurrency: string,
  targetCurrency: string,
  date: string
): Promise<number | null> {
  return (await createHistoricalRateResolver(orgId)(baseCurrency, targetCurrency, date))?.rate ?? null;
}

/**
 * Convert an amount using an exchange rate.
 * Both amount and rate are integers. Rate has 6 decimal places.
 * Returns converted amount in cents.
 */
export function convertAmount(amountCents: number, rate: number): number {
  return Math.round((amountCents * rate) / 1000000);
}

/**
 * Calculate FX gain/loss between original and current rate.
 * Returns positive for gain, negative for loss.
 */
export function calculateFxGainLoss(
  amountCents: number,
  originalRate: number,
  currentRate: number
): number {
  const originalConverted = convertAmount(amountCents, originalRate);
  const currentConverted = convertAmount(amountCents, currentRate);
  return currentConverted - originalConverted;
}
