import { roundRatio } from "./exact";
import { legacyMinor, WireCompatibilityError } from "./wire";

/** Explicit bridge for the existing safe-number posting/storage contract. */
export function postingInteger(value: number): bigint {
  if (!Number.isSafeInteger(value)) throw new WireCompatibilityError("Posting requires safe integer minor units or integer ratio controls");
  return BigInt(value);
}

/** Preserve the historical signed tie toward +infinity without binary floats. */
export function postingRatio(amount: number, numerator: number, denominator: number): number {
  const product = postingInteger(amount) * postingInteger(numerator);
  const divisor = postingInteger(denominator);
  if (divisor <= 0n) throw new WireCompatibilityError("Posting ratio denominator must be positive");
  return legacyMinor(roundRatio(2n * product + divisor, 2n * divisor, "floor"));
}

export function postingSum(values: Iterable<number>): number {
  let total = 0n;
  for (const value of values) total += postingInteger(value);
  return legacyMinor(total);
}

export function postingDifference(left: number, right: number): number {
  return legacyMinor(postingInteger(left) - postingInteger(right));
}

/** Gross-inclusive VAT and recoverability are basis-point ratios, never currency scales. */
export function postingGrossTax(gross: number, rateBp: number, recoverableBp: number) {
  postingInteger(gross);
  if (!Number.isInteger(rateBp) || rateBp < 0 || rateBp > 2147483647 ||
    !Number.isInteger(recoverableBp) || recoverableBp < 0 || recoverableBp > 10000)
    throw new WireCompatibilityError("Invalid tax basis points or recoverability");
  const tax = postingRatio(gross, rateBp, 10000 + rateBp);
  const recoverableTax = postingRatio(tax, recoverableBp, 10000);
  return { net: postingDifference(gross, tax), tax, recoverableTax, absorbedTax: postingDifference(tax, recoverableTax) };
}
