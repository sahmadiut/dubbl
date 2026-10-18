import type { useTranslations } from "next-intl";
import { assetLoanJson } from "@/lib/money/asset-loan-ui";

export const ASSET_CATEGORY_METHODS = ["straight_line", "declining_balance", "units_of_production", "sum_of_years_digits"] as const;
export const ASSET_CATEGORY_CONVENTIONS = ["full_month", "mid_month", "half_year", "mid_quarter", "pro_rata_days", "full_at_purchase"] as const;
type Translate = ReturnType<typeof useTranslations<"AssetCategories">>;
type ErrorTranslate = ReturnType<typeof useTranslations<"AssetCategoryErrors">>;
const methodKeys = {
  straight_line: "straight_lineShort", declining_balance: "declining_balanceShort",
  units_of_production: "units_of_productionShort", sum_of_years_digits: "sum_of_years_digitsShort",
} as const;

export function assetCategoryMethodLabel(t: Translate, method: string) {
  return Object.hasOwn(methodKeys, method) ? t(methodKeys[method as keyof typeof methodKeys]) : method;
}

const requestKeys = {
  "Asset category not found": "missing",
  "assetAccountId must be a live active organization account": "accountUnavailable",
  "depreciationAccountId must be a live active organization account": "accountUnavailable",
  "accumulatedDepAccountId must be a live active organization account": "accountUnavailable",
  "cwipAccountId must be a live active organization account": "accountUnavailable",
  "Saved asset account is outside the organization": "savedAccountInvalid",
} as const;
const inputKeys = {
  "Enter a nonnegative amount with at most two decimal places": "amount",
  "Enter a nonnegative amount with at most two decimal places within the supported range": "amountRange",
  "Enter a whole useful life in months from 1 to 2147483647": "life",
  "Enter a depreciation rate from 0% to 1000% with at most two decimal places": "rate",
} as const;

export class AssetCategoryRequestError extends Error {}

/** Translate approved service errors; validate successful money pairs before adoption. */
export async function assetCategoryJson(response: Response, t: ErrorTranslate, fallback: string) {
  if (!response.ok) {
    let message: unknown, code: unknown;
    try { const body = await response.json(); message = body?.error; code = body?.code; } catch { /* Use status/fallback. */ }
    let display = fallback;
    if (response.status === 401) display = t("unauthenticated");
    else if (response.status === 403) display = t("forbidden");
    else if (typeof message === "string" && Object.hasOwn(requestKeys, message)) display = t(requestKeys[message as keyof typeof requestKeys]);
    else if (code === "LEGACY_NUMERIC_RANGE") display = t("invalidMoney");
    else if (response.status === 400 || response.status === 422) display = t("invalidInput");
    throw new AssetCategoryRequestError(display);
  }
  return assetLoanJson(response);
}

/** Network/parser prose is never shown; only known local input errors translate. */
export function assetCategoryFailureMessage(error: unknown, t: ErrorTranslate, fallback: string) {
  if (error instanceof AssetCategoryRequestError) return error.message;
  if (error instanceof RangeError && Object.hasOwn(inputKeys, error.message)) return t(inputKeys[error.message as keyof typeof inputKeys]);
  return fallback;
}
