import { currencyMetadata, money, toMajorDecimal } from "./exact";

/** Exact English presentation for adopted expense amounts; locale expansion remains separate. */
export function expenseMoneyDisplay(amount: bigint, currency: string) {
  if (amount < 0n) throw new RangeError("Expense amount must be nonnegative");
  const { code, minorUnits } = currencyMetadata(currency), scale = 10n ** BigInt(minorUnits);
  const decimal = toMajorDecimal(money(amount, code)), fraction = decimal.split(".")[1];
  return new Intl.NumberFormat("en-US", { style: "currency", currency: code, minimumFractionDigits: minorUnits, maximumFractionDigits: minorUnits })
    .formatToParts(amount / scale).map(part => part.type === "fraction" ? fraction : part.value).join("");
}
export function expenseSummaryDisplay(buckets: { amountMinor: string; currencyCode: string }[]) {
  if (!buckets.length) return "0";
  if (new Set(buckets.map(row => row.currencyCode)).size !== 1) return "Multiple currencies";
  return expenseMoneyDisplay(buckets.reduce((sum, row) => sum + BigInt(row.amountMinor), 0n), buckets[0].currencyCode);
}
