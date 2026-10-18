import type { useTranslations } from "next-intl";
import { budgetJson } from "@/lib/money/budget-ui";

type Translate = ReturnType<typeof useTranslations<"Budgets">>;
const types = { daily: "daily", weekly: "weekly", monthly: "monthly", quarterly: "quarterly", yearly: "yearly", custom: "custom" } as const;
export function budgetTypeLabel(t: Translate, value: string) {
  return Object.hasOwn(types, value) ? t(types[value as keyof typeof types]) : value;
}

const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;
/** Display generated labels through catalogs; never rewrite stored labels or custom text. */
export function budgetPeriodLabel(t: Translate, label: string) {
  if (label === "Full Period") return t("fullPeriod");
  const week = /^Week ([1-9]\d*)$/.exec(label);
  if (week) return t("weekLabel", { number: week[1] });
  const quarter = /^Q([1-4]) (\d{4})$/.exec(label);
  if (quarter) return t("quarterLabel", { number: quarter[1], year: quarter[2] });
  const date = /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (?:(\d{1,2}), )?(\d{4})$/.exec(label);
  if (date) {
    const month = t(`month${months[months.indexOf(date[1] as typeof months[number])]}`);
    return date[2] ? t("dayLabel", { month, day: date[2], year: date[3] }) : t("monthLabel", { month, year: date[3] });
  }
  return label;
}

export class BudgetRequestError extends Error {}
/** Validate status before success UI; unknown server prose stays behind a reviewed fallback. */
export async function requireBudgetResponse(response: Response, t: Translate, fallback: string) {
  if (response.ok) return response;
  let code: unknown;
  try { code = (await response.json())?.code; } catch { /* Use status/fallback. */ }
  throw new BudgetRequestError(response.status === 401 ? t("unauthenticated")
    : response.status === 403 ? t("forbidden")
    : code === "LEGACY_NUMERIC_RANGE" ? t("invalidMoney")
    : response.status === 400 || response.status === 422 ? t("invalidInput") : fallback);
}
export async function budgetReadJson(response: Response, t: Translate, fallback: string) {
  return budgetJson(await requireBudgetResponse(response, t, fallback));
}
export function budgetFailureMessage(error: unknown, t: Translate, fallback: string) {
  if (error instanceof BudgetRequestError) return error.message;
  if (error instanceof RangeError) {
    if (error.message === "Enter an amount with at most two decimal places") return t("amountInvalid");
    if (error.message === "Budget amount exceeds the supported range") return t("amountRange");
  }
  return fallback;
}
