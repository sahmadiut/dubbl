import type { useTranslations } from "next-intl";

export type AccountTranslate = ReturnType<typeof useTranslations<"Accounts">>;
const typeKeys = { asset: "asset", liability: "liability", equity: "equity", revenue: "revenue", expense: "expense" } as const;
const groupKeys = { asset: "assetsGroup", liability: "liabilitiesGroup", equity: "equityGroup", revenue: "incomeGroup", expense: "expensesGroup" } as const;

export function accountTypeLabel(t: AccountTranslate, type: string) {
  return Object.hasOwn(typeKeys, type) ? t(typeKeys[type as keyof typeof typeKeys]) : type;
}

export function accountTypeGroupLabel(t: AccountTranslate, type: string) {
  return Object.hasOwn(groupKeys, type) ? t(groupKeys[type as keyof typeof groupKeys]) : type;
}

type ErrorTranslate = ReturnType<typeof useTranslations<"AccountErrors">>;
const errorKeys = {
  "Not found": "missing",
  "Account code already exists": "duplicateCode",
  "Tax rate not found": "taxRateMissing",
  "Cannot change the type of a system account": "systemType",
  "This is a built-in category, so its name and code can't be changed. Create your own category instead.": "systemIdentity",
  "This is a built-in category, so it can't be deleted. Mark it inactive to hide it instead.": "systemDelete",
  "Cannot delete account with existing transactions": "hasTransactions",
} as const;

export class AccountRequestError extends Error {}

export async function requireAccountResponse(response: Response, t: ErrorTranslate, fallback: string) {
  if (!response.ok) {
    let message: unknown;
    try { message = (await response.json()).error; } catch { /* Use status/fallback. */ }
    let display = fallback;
    if (typeof message === "string" && Object.hasOwn(errorKeys, message)) display = t(errorKeys[message as keyof typeof errorKeys]);
    else if (response.status === 401) display = t("unauthenticated");
    else if (response.status === 403) display = t("forbidden");
    else if (response.status === 400 || response.status === 422) display = t("invalidInput");
    throw new AccountRequestError(display);
  }
  return response;
}

export function accountFailureMessage(error: unknown, fallback: string) {
  return error instanceof AccountRequestError ? error.message : fallback;
}
