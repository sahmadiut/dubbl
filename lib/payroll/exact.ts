import { roundRatio } from "@/lib/money/exact";
import { legacyMinor, legacyMinorSchema, WireCompatibilityError } from "@/lib/money/wire";
import { exactRate } from "@/lib/currency/exact-rate";

/** Exact intermediates; the existing number ORM/wire remains bounded to safe cents. */
export function payrollInteger(value: number): bigint {
  if (!legacyMinorSchema.safeParse(value).success)
    throw new WireCompatibilityError("Payroll requires safe integer cents/counts");
  return BigInt(value);
}
export function payrollNumber(value: bigint): number {
  const limit = BigInt(Number.MAX_SAFE_INTEGER);
  if (value < -limit || value > limit) throw new WireCompatibilityError("Payroll result exceeds the supported safe cents range");
  return legacyMinor(value);
}
export function payrollSum(values: readonly number[]): number {
  return payrollNumber(values.reduce((sum, value) => sum + payrollInteger(value), 0n));
}
export function payrollRatio(value: number, numerator: bigint, denominator: bigint): number {
  return payrollNumber(roundRatio(payrollInteger(value) * numerator, denominator, "half-away-from-zero"));
}
/** PostgreSQL real quantities are exact multiples of 2^-149. Never multiply money as Number. */
export function payrollReal(value: number): bigint {
  if (!Number.isFinite(value) || value < 0 || value > Number.MAX_SAFE_INTEGER || Object.is(value, -0) || Math.fround(value) !== value)
    throw new WireCompatibilityError("Unsupported saved payroll binary32 quantity");
  return BigInt(value * 2 ** 149);
}
export const PAYROLL_REAL_SCALE = 2n ** 149n;
export function payrollPercent(amount: number, percent: number): number {
  if (percent > 100) throw new WireCompatibilityError("Payroll deduction percent exceeds 100");
  return payrollRatio(amount, payrollReal(percent), PAYROLL_REAL_SCALE * 100n);
}
export function payrollConvert(amount: number, rate: string): number {
  const [whole, fraction = ""] = exactRate(rate).split(".");
  return payrollRatio(amount, BigInt(whole + fraction), 10n ** BigInt(fraction.length));
}
/** A legacy real is a decimal multiplier, never scaled millionths. Preserve its actual value. */
export function payrollLegacyRate(value: number): string {
  payrollReal(value);
  if (value <= 0) throw new WireCompatibilityError("Payroll FX must be positive");
  // Convert the binary32 rational to a terminating decimal, then enforce the 20/18 policy.
  let numerator = payrollReal(value), denominator = PAYROLL_REAL_SCALE;
  while (denominator > 1n && numerator % 2n === 0n) { numerator /= 2n; denominator /= 2n; }
  let scale = 0;
  while (denominator > 1n) { denominator /= 2n; numerator *= 5n; scale++; }
  const digits = numerator.toString().padStart(scale + 1, "0");
  try { return exactRate(scale ? digits.slice(0, -scale) + "." + digits.slice(-scale) : digits); }
  catch { throw new WireCompatibilityError("Legacy payroll real FX is not lossless in the exact 20/18 decimal policy"); }
}
