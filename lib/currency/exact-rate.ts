/** Storage format v1: positive quote units per one base unit, 20 whole/18 fractional digits.
 * No implicit reciprocal rounding or conversion through binary floating point.
 */
export const FX_FORMAT_VERSION = 1;
export const FX_DIRECTION = "quote_per_base";
export const FX_MAX_SCALE = 18;

export function exactRate(value: string): string {
  if (typeof value !== "string" || value.length > 128 || !/^\d+(?:\.\d+)?$/.test(value)) {
    throw new TypeError("FX rate requires an unsigned ASCII decimal string");
  }
  const [wholeInput, fractionInput = ""] = value.split(".");
  const whole = wholeInput.replace(/^0+(?=\d)/, "");
  const fraction = fractionInput.replace(/0+$/, "");
  if (whole.length > 20 || fraction.length > FX_MAX_SCALE || !/[1-9]/.test(whole + fraction)) {
    throw new RangeError("FX rate must be positive with at most 20 whole and 18 fractional digits");
  }
  return whole + (fraction ? `.${fraction}` : "");
}

/** Exactly reconstruct a positive int32 legacy rate in millionths. */
export function fromLegacyRate(value: number): string {
  if (!Number.isInteger(value) || value <= 0 || value > 2147483647) {
    throw new RangeError("Legacy FX rate requires a positive int32 in millionths");
  }
  const units = BigInt(value);
  return exactRate(`${units / BigInt(1000000)}.${(units % BigInt(1000000)).toString().padStart(6, "0")}`);
}

/** Coexistence is lossless only when the v1 int32 field can represent the exact value. */
export function toLegacyRate(value: string): number {
  const [whole, fraction = ""] = exactRate(value).split(".");
  if (fraction.length > 6) throw new RangeError("FX rate cannot be represented exactly in legacy millionths");
  const scaled = BigInt(whole) * BigInt(1000000) + BigInt(fraction.padEnd(6, "0"));
  if (scaled > BigInt(2147483647)) throw new RangeError("FX rate exceeds the legacy int32 range");
  return Number(scaled);
}
