import type { useTranslations } from "next-intl";
import { BankAccountRequestError } from "./bank-account-presentation";

export type WorkspaceTranslate = ReturnType<typeof useTranslations<"BankWorkspace">>;

const validationKeys = {
  "Expense must equal the statement amount": "expenseEqual",
  "Select an outstanding document": "selectDocument",
  "Document currency must match the bank": "documentCurrency",
  "Payment must cover the full statement amount": "fullPayment",
  "Amount exceeds the document balance": "exceedsBalance",
  "Add at least one category and amount": "addCategoryAmount",
  "Select a category for every amount": "eachCategory",
  "The parts must add up to the transaction amount": "partsTotal",
} as const;

export function bankWorkspaceFailure(error: unknown, t: WorkspaceTranslate, fallback: string) {
  if (error instanceof BankAccountRequestError) return error.message;
  if (error instanceof RangeError) {
    if (Object.hasOwn(validationKeys, error.message)) return t(validationKeys[error.message as keyof typeof validationKeys]);
    const amount = /^Enter a positive amount with valid decimal places for ([A-Z]{3}) and within the supported range$/.exec(error.message);
    if (amount) return t("invalidAmount", { currency: amount[1] });
  }
  return fallback;
}

const reasonKeys = {
  "Exact amount match": "exactAmount", "Amount within 1%": "amountOnePercent", "Amount within 5%": "amountFivePercent",
  "Same date": "sameDate", "Within 1 day": "withinDay", "Within 3 days": "withinThreeDays", "Within 7 days": "withinWeek",
  "Exact reference match": "exactReference", "Partial reference match": "partialReference", "Exact description match": "exactDescription",
  "Strong description overlap": "strongDescription", "Some description overlap": "someDescription", "Reference found in description": "referenceDescription",
  "Direction matches type": "directionType",
} as const;

export function bankMatchReason(t: WorkspaceTranslate, reason: string) {
  return t(Object.hasOwn(reasonKeys, reason) ? reasonKeys[reason as keyof typeof reasonKeys] : "unknownReason");
}
