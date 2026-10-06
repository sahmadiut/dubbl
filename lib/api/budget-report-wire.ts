import { z } from "zod";
import { roundRatio, currencyMetadata } from "@/lib/money/exact";
import { WireCompatibilityError } from "@/lib/money/wire";
import { safeBudgetMinor, validateBudgetDates } from "./budget-wire";

export const budgetReportSchema = z.object({
  budgetId: z.string().uuid().optional().describe("Budget UUID in this organization; omit for the newest non-deleted budget, including inactive budgets"),
}).strict();

export function budgetReportQuery(request: Request) {
  const query = new URL(request.url).searchParams;
  if ([...query.keys()].some(key => key !== "budgetId") || query.getAll("budgetId").length > 1) {
    throw new z.ZodError([{ code: "custom", path: [], message: "Expected at most one budgetId query parameter" }]);
  }
  return budgetReportSchema.parse(Object.fromEntries(query));
}

/** Match Math.round's nearest-integer policy, with signed ties toward +infinity. */
export function budgetReportRound(numerator: bigint, denominator: bigint) {
  if (denominator < 0n) { numerator = -numerator; denominator = -denominator; }
  return roundRatio(2n * numerator + denominator, 2n * denominator, "floor");
}

export function budgetReportMoney<T extends Record<string, bigint>>(fields: T) {
  const result: Record<string, number | string> = {};
  for (const [key, amount] of Object.entries(fields)) {
    result[key] = safeBudgetMinor(amount);
    result[`${key}Minor`] = amount.toString();
  }
  return result as { [K in keyof T]: number } & { [K in keyof T as `${K & string}Minor`]: string };
}

export function budgetReportStoredAmount(value: number) {
  if (!Number.isSafeInteger(value)) throw new WireCompatibilityError("Unsupported stored budget cents");
  return BigInt(value);
}

export function budgetReportDates(start: string, end: string, now: Date) {
  try { validateBudgetDates(start, end); }
  catch { throw new WireCompatibilityError("Unsupported stored budget report dates"); }
  const startMs = Date.parse(`${start}T00:00:00Z`);
  const totalDays = (Date.parse(`${end}T00:00:00Z`) - startMs) / 86400000 + 1;
  if (!Number.isFinite(now.getTime())) throw new WireCompatibilityError("Invalid report clock");
  const daysElapsed = Math.max(0, Math.min(totalDays, Math.round((now.getTime() - startMs) / 86400000)));
  return { totalDays, daysElapsed, daysRemaining: totalDays - daysElapsed };
}

export type BudgetReportActual = { debit: bigint; credit: bigint };
export function budgetReportActual(type: string, value?: BudgetReportActual) {
  if (!["asset", "expense", "liability", "equity", "revenue"].includes(type)) {
    throw new WireCompatibilityError("Unsupported budget account type");
  }
  if (!value) return 0n;
  return type === "asset" || type === "expense" ? value.debit - value.credit : value.credit - value.debit;
}

export function budgetReportCurrency(value: string) {
  try {
    if (currencyMetadata(value).code !== value) throw new Error("Non-canonical currency");
    return value;
  } catch { throw new WireCompatibilityError("Unsupported organization report currency"); }
}
