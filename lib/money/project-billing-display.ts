/** Same exact decimal percent and half-up product used by project billing. */
export function projectBillingPercent(value: string) {
  if (value.length > 32 || !/^(?:0|[1-9]\d{0,2})(?:\.\d{1,9})?$/.test(value)) throw new RangeError("Enter a percent from 0 through 100 with at most nine decimal places");
  const [whole, fraction = ""] = value.split("."), denominator = 10n ** BigInt(fraction.length), numerator = BigInt(whole + fraction);
  if (numerator > 100n * denominator) throw new RangeError("Percent exceeds 100");
  return { numerator, denominator, percent: Number(value) };
}
export function projectBillingFixedCents(amount: number | string, percent: string) {
  const { numerator, denominator } = projectBillingPercent(percent), d = denominator * 100n;
  return (BigInt(amount) * numerator * 2n + d) / (2n * d);
}
