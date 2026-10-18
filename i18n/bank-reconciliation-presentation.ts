import type { useTranslations } from "next-intl";
import { BankAccountRequestError, requireBankAccountResponse } from "./bank-account-presentation";

type Translate = ReturnType<typeof useTranslations<"BankReconciliation">>;
type Errors = ReturnType<typeof useTranslations<"BankAccountErrors">>;

const errorKeys = {
  "Reconciliation requires an active bank account": "inactiveBank",
  "Reconciliation not found": "missingCheck",
  "Reconciliation is already completed": "alreadyCompleted",
  "Transaction date is outside the statement window": "outsideWindow",
  "Statement window overlaps an existing reconciliation": "overlap",
  "Transaction IDs must be distinct": "distinctIds",
  "Statement completion requires bank and GL in the same currency; foreign balance qualification is separate": "sameCurrency",
  "Every requested line must belong to this bank/window and be unattached": "ownedLines",
  "Statement completion requires all nonexcluded lines in its window": "allLines",
  "Every statement line must be accounted for before completion": "accountedLines",
  "Opening balance plus statement movements must equal closing balance": "closingMovements",
  "Statement closing balance must equal the bank GL before completion": "closingLedger",
  "Adjustment amount must be nonzero": "nonzero",
  "Adjustments require bank and base currency to match; no mixed-unit adjustment": "adjustCurrency",
  "Adjustment account not found": "missingAdjustmentAccount",
  "Adjustment account must be active, correctly typed and denominated": "adjustAccount",
  "Undo linked reconciliation history before excluding a statement": "excludeHistory",
} as const;

// Presentation only: canonical REST/MCP messages and codes remain unchanged.
export async function requireReconciliationResponse(response: Response, t: Translate, errors: Errors, fallback: string) {
  if (!response.ok) {
    let message: unknown;
    try { message = (await response.clone().json()).error; } catch { /* Use the shared status fallback. */ }
    if (typeof message === "string" && Object.hasOwn(errorKeys, message))
      throw new BankAccountRequestError(t(errorKeys[message as keyof typeof errorKeys]));
  }
  return requireBankAccountResponse(response, errors, fallback);
}

export function reconciliationFailure(error: unknown, t: Translate, fallback: string) {
  if (error instanceof BankAccountRequestError) return error.message;
  if (error instanceof RangeError && [
    "Enter a valid decimal balance", "Balance exceeds the supported range",
    "Fractional minor unit requires rounding", "Minor-unit overflow",
  ].includes(error.message)) return t("invalidBalance");
  return fallback;
}
