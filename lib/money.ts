/**
 * Legacy Number-based compatibility utilities. New accounting code must use
 * lib/money/exact.ts. These functions retain existing v1 behavior until cutover.
 * All amounts are stored as integer minor units (e.g. $12.50 = 1250).
 * The number of minor units depends on the currency — most have 2, but
 * JPY/KRW have 0 and KWD/BHD/OMR have 3, so display scales per currency.
 */
import { getCurrencyMinorUnits } from "@/lib/currency/iso4217";

/** @deprecated Use toMajorDecimal from lib/money/exact. Legacy fixed scale. */
export function centsToDecimal(cents: number, decimals = 2): string {
  return (cents / Math.pow(10, decimals)).toFixed(decimals);
}

/** @deprecated Use parseMajor with explicit currency and rounding. */
export function decimalToCents(value: string | number, decimals = 2): number {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return 0;
  return Math.round(num * Math.pow(10, decimals));
}

/**
 * Currency-aware conversions: scale by the currency's REAL minor units, so a
 * 0-decimal currency (JPY/KRW) and a 3-decimal one (KWD/BHD/OMR) round-trip
 * correctly — unlike the fixed 2-decimal helpers above which over/under-scale
 * those currencies. These are the helpers the write boundary should use once
 * the codebase threads the document currency through to amount conversion
 * (alongside a one-off migration of any existing non-2dp data).
 */
/** @deprecated Use parseMajor from lib/money/exact. */
export function decimalToMinorUnits(
  value: string | number,
  currency = "USD"
): number {
  return decimalToCents(value, getCurrencyMinorUnits(currency));
}

/** @deprecated Use toMajorDecimal from lib/money/exact. */
export function minorUnitsToDecimal(units: number, currency = "USD"): string {
  return centsToDecimal(units, getCurrencyMinorUnits(currency));
}

/**
 * Format an integer minor-unit amount as a currency string.
 * Scales and sets fraction digits by the currency's real minor units, so
 * 1250 → "$12.50" (USD), 1250 → "¥1,250" (JPY), 1250 → "KWD 1.250" (KWD).
 */
/** @deprecated Legacy Number formatter; exact locale adapter is later boundary work. */
export function formatMoney(
  cents: number,
  currency = "USD",
  locale = "en-US"
): string {
  const minorUnits = getCurrencyMinorUnits(currency);
  const amount = cents / Math.pow(10, minorUnits);
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: minorUnits,
    maximumFractionDigits: minorUnits,
  }).format(amount);
}

/** @deprecated Legacy permissive parser; use strict parseMajor after locale normalization. */
export function parseMoney(input: string): number {
  const cleaned = input.replace(/[^0-9.\-]/g, "");
  return decimalToCents(cleaned);
}

/** @deprecated Use taxMoney with explicit rounding. */
export function calculateTax(amountCents: number, ratePercent: number): number {
  return Math.round(amountCents * (ratePercent / 100));
}

/** @deprecated Use taxMoney and addMoney. */
export function addTax(
  netCents: number,
  ratePercent: number
): { net: number; tax: number; gross: number } {
  const tax = calculateTax(netCents, ratePercent);
  return { net: netCents, tax, gross: netCents + tax };
}

/** @deprecated Use sumMoney; this legacy sum does not enforce safe integer bounds. */
export function sumCents(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}
