/** Exact monetary primitives. No implicit currency, rounding or Number arithmetic. */
import { CURRENCY_SCALES } from "./scales";

export const MIN_MINOR = -(BigInt(2) ** BigInt(63));
export const MAX_MINOR = BigInt(2) ** BigInt(63) - BigInt(1);
export type RoundingMode =
  | "reject" | "toward-zero" | "floor" | "ceiling"
  | "half-away-from-zero" | "half-even";
export type Money = Readonly<{ amountMinor: bigint; currency: string }>;
const ZERO = BigInt(0);
const ONE = BigInt(1);
const TWO = BigInt(2);
const TEN = BigInt(10);

export function currencyMetadata(currency: string): Readonly<{ code: string; minorUnits: number }> {
  const code = currency.toUpperCase();
  if (!Object.hasOwn(CURRENCY_SCALES, code)) throw new RangeError(`Unsupported currency: ${currency}`);
  return Object.freeze({ code, minorUnits: CURRENCY_SCALES[code] });
}

/** Enforce the signed PostgreSQL bigint storage range on final monetary results. */
export function checkedMinor(amount: bigint): bigint {
  if (typeof amount !== "bigint") throw new TypeError("Minor units must be bigint");
  if (amount < MIN_MINOR || amount > MAX_MINOR) throw new RangeError("Minor-unit overflow");
  return amount;
}

export function money(amountMinor: bigint, currency: string): Money {
  return Object.freeze({ amountMinor: checkedMinor(amountMinor), currency: currencyMetadata(currency).code });
}

/** Exact ratio rounding; a negative denominator is normalized before rounding. */
export function roundRatio(numerator: bigint, denominator: bigint, mode: RoundingMode): bigint {
  if (typeof numerator !== "bigint" || typeof denominator !== "bigint") throw new TypeError("Ratio operands must be bigint");
  if (!["reject", "toward-zero", "floor", "ceiling", "half-away-from-zero", "half-even"].includes(mode)) {
    throw new RangeError("An explicit supported rounding mode is required");
  }
  if (denominator === ZERO) throw new RangeError("Division by zero");
  if (denominator < ZERO) { numerator = -numerator; denominator = -denominator; }
  const quotient = numerator / denominator;
  const remainder = numerator % denominator;
  if (remainder === ZERO) return quotient;
  const sign = numerator < ZERO ? -ONE : ONE;
  const magnitude = remainder < ZERO ? -remainder : remainder;
  switch (mode) {
    case "reject": throw new RangeError("Fractional minor unit requires rounding");
    case "toward-zero": return quotient;
    case "floor": return numerator < ZERO ? quotient - ONE : quotient;
    case "ceiling": return numerator > ZERO ? quotient + ONE : quotient;
    case "half-away-from-zero": return magnitude * TWO >= denominator ? quotient + sign : quotient;
    case "half-even":
      return magnitude * TWO > denominator || (magnitude * TWO === denominator && quotient % TWO !== ZERO)
        ? quotient + sign : quotient;
  }
}

/** Canonical ASCII decimal input only. Locale normalization belongs at the UI boundary. */
function decimalRatio(value: string): { numerator: bigint; denominator: bigint } {
  if (typeof value !== "string" || value.length > 256 || !/^[+-]?\d+(?:\.\d+)?$/.test(value)) {
    throw new TypeError("Expected a canonical decimal string (maximum 256 characters)");
  }
  const negative = value.startsWith("-");
  const unsigned = value.replace(/^[+-]/, "");
  const [whole, fraction = ""] = unsigned.split(".");
  return {
    numerator: BigInt(whole + fraction) * (negative ? -ONE : ONE),
    denominator: TEN ** BigInt(fraction.length),
  };
}

export function parseMajor(value: string, currency: string, rounding: RoundingMode): Money {
  const { code, minorUnits } = currencyMetadata(currency);
  const { numerator, denominator } = decimalRatio(value);
  return money(roundRatio(numerator * TEN ** BigInt(minorUnits), denominator, rounding), code);
}

/** Exact decimal output, including amounts outside the JS safe-number range. */
export function toMajorDecimal(value: Money): string {
  const { minorUnits } = currencyMetadata(value.currency);
  const amount = checkedMinor(value.amountMinor);
  const absolute = amount < ZERO ? -amount : amount;
  const scale = TEN ** BigInt(minorUnits);
  const sign = amount < ZERO ? "-" : "";
  return sign + (absolute / scale).toString() + (minorUnits === 0 ? "" : "." + (absolute % scale).toString().padStart(minorUnits, "0"));
}

function sameCurrency(a: Money, b: Money): string {
  const code = currencyMetadata(a.currency).code;
  if (code !== currencyMetadata(b.currency).code) throw new RangeError("Currency mismatch");
  checkedMinor(a.amountMinor);
  checkedMinor(b.amountMinor);
  return code;
}

export function addMoney(a: Money, b: Money): Money {
  return money(a.amountMinor + b.amountMinor, sameCurrency(a, b));
}

export function subtractMoney(a: Money, b: Money): Money {
  return money(a.amountMinor - b.amountMinor, sameCurrency(a, b));
}

export function negateMoney(value: Money): Money {
  checkedMinor(value.amountMinor);
  return money(-value.amountMinor, value.currency);
}

/** Validate every operand; allow exact intermediate sums, range-check the final result. */
export function sumMoney(values: readonly Money[], currency: string): Money {
  const code = currencyMetadata(currency).code;
  let total = ZERO;
  for (const value of values) {
    sameCurrency(money(ZERO, code), value);
    total += value.amountMinor;
  }
  return money(total, code);
}

/** For quantity/discount/FX ratios. Units and FX direction remain the caller's responsibility. */
export function multiplyRatio(value: Money, numerator: bigint, denominator: bigint, rounding: RoundingMode): Money {
  checkedMinor(value.amountMinor);
  return money(roundRatio(value.amountMinor * numerator, denominator, rounding), value.currency);
}

/** Plain percent decimal, e.g. "12.5" means 12.5%, not basis points. No implicit tax policy. */
export function taxMoney(net: Money, percent: string, rounding: RoundingMode): Money {
  const { numerator, denominator } = decimalRatio(percent);
  if (numerator < ZERO) throw new RangeError("Tax percent must be nonnegative");
  return multiplyRatio(net, numerator, denominator * BigInt(100), rounding);
}

/** Largest-remainder allocation. Ties go to input order; negatives mirror positives exactly. */
export function allocateMoney(total: Money, weights: readonly bigint[]): Money[] {
  checkedMinor(total.amountMinor);
  currencyMetadata(total.currency);
  if (!weights.length || weights.some(w => typeof w !== "bigint" || w < ZERO)) {
    throw new RangeError("Allocation needs nonnegative bigint weights");
  }
  const denominator = weights.reduce((a, b) => a + b, ZERO);
  if (denominator === ZERO) throw new RangeError("Allocation weights must have a positive sum");
  const negative = total.amountMinor < ZERO;
  const absolute = negative ? -total.amountMinor : total.amountMinor;
  const parts = weights.map((weight, index) => ({ index, amount: absolute * weight / denominator, remainder: absolute * weight % denominator }));
  let residual = absolute - parts.reduce((a, b) => a + b.amount, ZERO);
  const ranked = [...parts].sort((a, b) => a.remainder === b.remainder ? a.index - b.index : a.remainder > b.remainder ? -1 : 1);
  for (const part of ranked) {
    if (residual === ZERO) break;
    part.amount += ONE;
    residual -= ONE;
  }
  return parts.map(part => money(negative ? -part.amount : part.amount, total.currency));
}

/** Only explicit compatibility boundaries may convert a checked safe integer to Number. */
export function toLegacyNumber(value: Money): number {
  checkedMinor(value.amountMinor);
  currencyMetadata(value.currency);
  const safe = BigInt(Number.MAX_SAFE_INTEGER);
  if (value.amountMinor < -safe || value.amountMinor > safe) throw new RangeError("Unsafe legacy number");
  return Number(value.amountMinor);
}

export function fromLegacyNumber(amount: number, currency: string): Money {
  if (!Number.isSafeInteger(amount)) throw new RangeError("Expected a safe integer minor-unit number");
  return money(BigInt(amount), currency);
}
