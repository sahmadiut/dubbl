import { z } from "zod";
import { exactRate, toLegacyRate } from "./exact-rate";

export function isoRateDate(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value < "0001-01-01" ||
      !Number.isFinite(Date.parse(`${value}T00:00:00Z`)) ||
      new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value) {
    throw new TypeError("Rate date must be a valid Gregorian YYYY-MM-DD date");
  }
  return value;
}

export const rateDateSchema = z.string().refine(value => {
  try { isoRateDate(value); return true; } catch { return false; }
}, "Rate date must be a valid Gregorian YYYY-MM-DD date")
  .describe("Effective Gregorian date, YYYY-MM-DD");

function units(value: string): bigint {
  const [whole, fraction = ""] = exactRate(value).split(".");
  return BigInt(whole) * 10n ** 18n + BigInt(fraction.padEnd(18, "0"));
}

/** Positive rational division, explicitly half-up at the requested decimal scale. */
export function divideRates(numerator: string, denominator: string, scale = 18): string {
  if (!Number.isInteger(scale) || scale < 0 || scale > 18) throw new RangeError("Invalid FX scale");
  const n = units(numerator) * 10n ** BigInt(scale), d = units(denominator);
  const rounded = n / d + (2n * (n % d) >= d ? 1n : 0n);
  const digits = rounded.toString().padStart(scale + 1, "0");
  return exactRate(scale ? `${digits.slice(0, -scale)}.${digits.slice(-scale)}` : digits);
}

/** Automatic movements exceeding 20% require a manual override. */
export function isExtremeRateChange(previous: string, candidate: string): boolean {
  const old = units(previous), next = units(candidate);
  const difference = next > old ? next - old : old - next;
  return difference * 100n > old * 20n;
}

/** Explicit coexistence rounding is allowed only within one basis point.
 * This rejects tiny reciprocal rates that six-place rounding would materially distort.
 */
export function legacyProviderRate(quote: string, legacyQuote: string | null): number {
  if (!legacyQuote) throw new RangeError("Unrepresentable provider quote");
  const rate = toLegacyRate(legacyQuote), original = units(quote), rounded = units(legacyQuote);
  const difference = rounded > original ? rounded - original : original - rounded;
  if (difference * 10000n > original) throw new RangeError("Legacy FX rounding exceeds one basis point");
  return rate;
}

/** Preserve provider numeric lexemes; JSON.parse validates the complete document. */
export function parseRateJson(body: string): unknown {
  if (body.length > 256_000) throw new RangeError("Provider response too large");
  // Validate original JSON grammar too (e.g. JSON forbids a leading-zero number).
  // Parsed numeric values are discarded; only the lexical second pass is used.
  JSON.parse(body);
  return JSON.parse(body.replace(/"(?:\\.|[^"\\])*"|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g,
    token => token.startsWith('"') ? token : JSON.stringify(token)));
}

/** Expand provider exponent notation with bounded work, never floating-point rate math. */
export function providerDecimal(value: unknown): string {
  if (typeof value !== "string" || value.length > 128) throw new TypeError("Invalid provider rate");
  const match = /^(\d+)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/.exec(value);
  if (!match) throw new TypeError("Invalid provider decimal");
  const exponent = Number(match[3] ?? 0);
  if (!Number.isInteger(exponent) || Math.abs(exponent) > 100) throw new RangeError("Provider exponent outside policy");
  const whole = match[1], fraction = match[2] ?? "";
  const digits = whole + fraction, point = whole.length + exponent;
  const expanded = point <= 0 ? `0.${"0".repeat(-point)}${digits}` :
    point >= digits.length ? digits + "0".repeat(point - digits.length) :
      `${digits.slice(0, point)}.${digits.slice(point)}`;
  return exactRate(expanded);
}
