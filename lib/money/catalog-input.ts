/** Existing catalog editors display prices in two-decimal major units (USD). */
export function catalogPriceMinor(value: string): string | undefined {
  if (value === "") return undefined;
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(value)) throw new Error("Enter a nonnegative price with at most two decimal places");
  const [whole, fraction = ""] = value.split(".");
  const minor = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
  if (minor > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("Price exceeds the supported range");
  return minor.toString();
}
export function catalogWholeInput(value: string, signed = false): number | undefined {
  if (value === "") return undefined;
  if (!/^(?:0|-?[1-9]\d*)$/.test(value)) throw new Error("Enter a whole number");
  const number = BigInt(value);
  if (number < (signed ? -2147483648n : 0n) || number > 2147483647n) throw new Error("Whole number is outside the supported range");
  return Number(number);
}
