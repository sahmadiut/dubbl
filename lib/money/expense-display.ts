import type { NumberPresentation } from "../../i18n/numbers";
import { bankMoneyDisplay } from "./bank-display";

/** Exact presentation retaining the nonnegative expense contract. */
export function expenseMoneyDisplay(amount: bigint, currency: string, presentation: NumberPresentation = { locale: "en-US", numerals: "latn" }) {
  if (amount < 0n) throw new RangeError("Expense amount must be nonnegative");
  return bankMoneyDisplay(amount, currency, presentation);
}
export function expenseSummaryDisplay(buckets: { amountMinor: string; currencyCode: string }[], presentation: NumberPresentation = { locale: "en-US", numerals: "latn" }) {
  if (!buckets.length) return "0";
  if (new Set(buckets.map(row => row.currencyCode)).size !== 1) return "Multiple currencies";
  return expenseMoneyDisplay(buckets.reduce((sum, row) => sum + BigInt(row.amountMinor), 0n), buckets[0].currencyCode, presentation);
}
