import { coreStoredMinor } from "./core-presentation";
import { assetCentsDecimal } from "./asset-display";
import { projectMoneyDisplay } from "./project-display";
import { parseMajor, roundRatio, currencyMetadata } from "./exact";

const fields = new Set(["total", "amount", "budgeted", "actual", "variance", "burnRate", "projected", "totalBudgeted", "totalActual", "totalVariance", "totalBurnRate"]);
type BudgetMoneyKey = "total" | "amount" | "budgeted" | "actual" | "variance" | "burnRate" | "projected" | "totalBudgeted" | "totalActual" | "totalVariance" | "totalBurnRate";
export type BudgetUi<T> = T extends readonly (infer U)[] ? BudgetUi<U>[] : T extends object ? { [K in keyof T]: K extends "total" ? ("totalMinor" extends keyof T ? bigint : T[K]) : K extends BudgetMoneyKey ? bigint : BudgetUi<T[K]> } : T;

/** Budget cents are signed and fixed two-decimal units, including base-ledger reports. */
export function budgetUiPayload<T>(value: T): BudgetUi<T> {
  if (Array.isArray(value)) return value.map(budgetUiPayload) as BudgetUi<T>;
  if (!value || typeof value !== "object") return value as BudgetUi<T>;
  const row = value as Record<string, unknown>, result = { ...row };
  if ("comparisons" in row && (typeof row.currencyCode !== "string" || currencyMetadata(row.currencyCode).code !== row.currencyCode)) throw new RangeError("Budget report currency is required");
  const required = "comparisons" in row ? ["totalBudgeted", "totalActual", "totalVariance", "totalBurnRate"]
    : "budgeted" in row || "actual" in row ? ["budgeted", "actual", "variance"]
    : "accountId" in row && "periods" in row ? ["total"] : "sortOrder" in row && "startDate" in row ? ["amount"] : [];
  for (const name of required) if (!(name in row)) throw new RangeError(`Missing saved budget ${name}`);
  for (const [name, child] of Object.entries(row)) {
    // Pagination total is a count, and report headers contain no amounts.
    if (fields.has(name) && (name !== "total" || "totalMinor" in row || required.includes(name))) {
      if (Object.is(child, -0)) throw new RangeError("Noncanonical budget amount");
      result[name] = coreStoredMinor(child as number, row[name + "Minor"] as string);
    } else if (child && typeof child === "object") result[name] = budgetUiPayload(child);
  }
  for (const name of fields) if (name + "Minor" in row && !(name in row)) throw new RangeError(`Missing numeric budget ${name}`);
  return result as BudgetUi<T>;
}
export async function budgetJson(response: Response) {
  const body = await response.json();
  if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "Unable to load budget");
  return budgetUiPayload(body);
}
export function budgetInput(value: string): bigint {
  if (value.length > 256 || !/^-?\d+(?:\.\d{1,2})?$/.test(value)) throw new RangeError("Enter an amount with at most two decimal places");
  const amount = parseMajor(value, "USD", "reject").amountMinor;
  if (amount > BigInt(Number.MAX_SAFE_INTEGER) || amount < -BigInt(Number.MAX_SAFE_INTEGER)) throw new RangeError("Budget amount exceeds the supported range");
  return amount;
}
export function budgetDraftInvalid(value: string) {
  try { budgetInput(value || "0"); return false; } catch { return true; }
}
/** Reindex drafts when a line is removed; keys are line indices or line:period indices, never money. */
export function budgetRemoveDraftLine(drafts: Record<string, string>, index: number) {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(drafts)) {
    const [line, period] = key.split(":"), i = Number(line);
    if (i === index) continue;
    const next = String(i > index ? i - 1 : i);
    result[period === undefined ? next : `${next}:${period}`] = value;
  }
  return result;
}
export const budgetDecimal = assetCentsDecimal;
export const budgetMoney = projectMoneyDisplay;
export const budgetAbs = (value: bigint) => value < 0n ? -value : value;
/** Match the report's historical signed Math.round policy, ties toward positive infinity. */
export function budgetPercent(actual: bigint, budgeted: bigint) {
  if (budgeted === 0n) return 0;
  let n = actual * 100n, d = budgeted;
  if (d < 0n) { n = -n; d = -d; }
  return Number(roundRatio(2n * n + d, 2n * d, "floor"));
}
export function budgetDistribute(total: bigint, count: number): bigint[] {
  if (!Number.isInteger(count) || count < 0 || count > 10000) throw new RangeError("Unsupported budget period count");
  if (!count) return [];
  const per = budgetPerPeriod(total, count), remainder = total - per * BigInt(count);
  return Array.from({ length: count }, (_, i) => per + (BigInt(i) < remainder ? 1n : 0n));
}
export function budgetPerPeriod(total: bigint, count: number) {
  if (!Number.isInteger(count) || count <= 0 || count > 10000) throw new RangeError("Unsupported budget period count");
  return roundRatio(total, BigInt(count), "floor");
}
export function budgetLinesInput<T extends { accountId: string; total: bigint; periods: { amount: bigint; label: string; startDate: string; endDate: string; sortOrder: number }[] }>(lines: T[]) {
  return lines.map(line => ({ accountId: line.accountId, totalMinor: budgetInput(budgetDecimal(line.total)).toString(),
    periods: line.periods.map(({ amount, ...period }) => ({ ...period, amountMinor: budgetInput(budgetDecimal(amount)).toString() })) }));
}
/** Floating values are used only for chart geometry; tooltips read exact saved cents. */
export function budgetChartPoint(label: string, budgeted: bigint, actual: bigint) {
  return { name: label, budgeted: Number(budgetDecimal(budgeted)), actual: Number(budgetDecimal(actual)), budgetedExact: budgeted, actualExact: actual };
}
/** Accrual REST input retains positive half-up cents rounding through 18 decimal places. */
export function accrualUiInput(value: string) {
  if (value.length > 40 || !/^(?:0|[1-9]\d{0,19})(?:\.\d{1,18})?$/.test(value)) throw new RangeError("Enter a positive decimal accrual amount");
  const amount = parseMajor(value, "USD", "half-away-from-zero").amountMinor;
  if (amount <= 0n || amount > BigInt(Number.MAX_SAFE_INTEGER)) throw new RangeError("Accrual cents must be positive and within the supported range");
  return { exact: value, minor: amount.toString() };
}
export function accrualUiPeriods(value: string) {
  if (!/^[1-9]\d{0,3}$/.test(value) || Number(value) > 1200) throw new RangeError("Enter a whole period count from 1 through 1200");
  return Number(value);
}
