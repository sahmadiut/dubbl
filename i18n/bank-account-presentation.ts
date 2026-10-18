import type { useTranslations } from "next-intl";

export const BANK_ACCOUNT_TYPES = ["checking", "savings", "credit_card", "cash", "loan", "investment", "other"] as const;
type Translate = ReturnType<typeof useTranslations<"BankAccounts">>;
type ErrorTranslate = ReturnType<typeof useTranslations<"BankAccountErrors">>;
const typeKeys = { checking: "checking", savings: "savings", credit_card: "credit_card", cash: "cash", loan: "loan", investment: "investment", other: "other" } as const;
const groupKeys = { checking: "checkingGroup", savings: "savingsGroup", credit_card: "credit_cardGroup", cash: "cashGroup", loan: "loanGroup", investment: "investmentGroup", other: "otherGroup" } as const;

export function bankAccountTypeLabel(t: Translate, type: string) {
  return Object.hasOwn(typeKeys, type) ? t(typeKeys[type as keyof typeof typeKeys]) : type;
}

export function bankAccountGroupLabel(t: Translate, type: string) {
  return Object.hasOwn(groupKeys, type) ? t(groupKeys[type as keyof typeof groupKeys]) : type;
}

const errorKeys = {
  "Bank account not found": "missing",
  "Organization not found": "organizationMissing",
  "Bank GL account must be active": "inactiveLedger",
  "GL account is already assigned to another bank account": "ledgerAssigned",
  "Bank currency, type and GL link cannot change after statement, payment or opening GL history": "historyLock",
  "Currency changes require zero saved and new balances and threshold": "currencyBalanceLock",
  "Couldn't connect this bank account to your books automatically. Please contact support.": "automaticLinkFailed",
} as const;

export class BankAccountRequestError extends Error {}

export async function requireBankAccountResponse(response: Response, t: ErrorTranslate, fallback: string) {
  if (!response.ok) {
    let message: unknown, code: unknown;
    try { const body = await response.json(); message = body.error; code = body.code; } catch { /* Use status/fallback. */ }
    let display = fallback;
    if (typeof message === "string" && Object.hasOwn(errorKeys, message)) display = t(errorKeys[message as keyof typeof errorKeys]);
    else if (response.status === 401) display = t("unauthenticated");
    else if (response.status === 403) display = t("forbidden");
    else if (code === "LEGACY_NUMERIC_RANGE") display = t("invalidMoney");
    else if (response.status === 400 || response.status === 422) display = t("invalidInput");
    throw new BankAccountRequestError(display);
  }
  return response;
}

export function bankAccountFailureMessage(error: unknown, fallback: string) {
  return error instanceof BankAccountRequestError ? error.message : fallback;
}
