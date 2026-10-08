import { z } from "zod";
import { budgetReportCurrency, budgetReportMoney, budgetReportRound, budgetReportStoredAmount } from "./budget-report-wire";
import { WireCompatibilityError } from "@/lib/money/wire";
import { money, toMajorDecimal } from "@/lib/money/exact";

export const budgetAlertSchema = z.object({}).strict();

/** Preserve absolute net activity and Math.round's positive half-up threshold policy. */
export function budgetAlertAmounts(amount: number, netActual: bigint, percent: number, currency: string) {
  if (!Number.isInteger(percent) || percent < 0 || percent > 2147483647) {
    throw new WireCompatibilityError("Unsupported stored budget threshold percent");
  }
  const budgeted = budgetReportStoredAmount(amount);
  const actual = netActual < 0n ? -netActual : netActual;
  const threshold = budgetReportRound(budgeted * BigInt(percent), 100n);
  const currencyCode = budgetReportCurrency(currency);
  return { currencyCode, thresholdPct: percent, ...budgetReportMoney({ budgeted, actual, threshold }),
    exceedsThreshold: budgeted > 0n && actual >= threshold };
}

export function budgetAlertBody(label: string, value: ReturnType<typeof budgetAlertAmounts>) {
  const format = (minor: string) => `${value.currencyCode} ${toMajorDecimal(money(BigInt(minor), value.currencyCode))}`;
  return `Period ${label}: actual ${format(value.actualMinor)} vs budget ${format(value.budgetedMinor)} (${value.thresholdPct}% threshold)`;
}
