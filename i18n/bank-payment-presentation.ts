import type { useTranslations } from "next-intl";
import { BankAccountRequestError, requireBankAccountResponse } from "./bank-account-presentation";

type Translate = ReturnType<typeof useTranslations<"BankPayments">>;
type Errors = ReturnType<typeof useTranslations<"BankAccountErrors">>;
const statuses = { pending: "pending", processing: "processing", completed: "completed", failed: "failed", cancelled: "cancelled", draft: "draft", submitted: "submitted" } as const;
export function bankPaymentStatus(t: Translate, status: string) {
  return t(Object.hasOwn(statuses, status) ? statuses[status as keyof typeof statuses] : "unknownStatus");
}

const errorKeys = {
  "Scheduled payment not found": "scheduleMissing",
  "Schedule requires an available recognized outstanding supplier bill, without overpayment or pre-recognition date": "scheduleBillInvalid",
  "Only pending scheduled payments can be updated": "pendingOnly",
  "Payment batch not found": "batchMissing",
  "Batch requires available recognized outstanding supplier bills without overpayment": "batchBillsInvalid",
  "Only draft batches can be updated": "draftUpdateOnly",
  "Only draft batches can be submitted": "draftSubmitOnly",
  "A transfer must be between two different bank accounts": "differentAccounts",
} as const;

// UI-only mapping; REST/MCP retain their canonical errors and status codes.
export async function requirePaymentResponse(response: Response, t: Translate, errors: Errors, fallback: string) {
  if (!response.ok) {
    let message: unknown;
    try { message = (await response.clone().json()).error; } catch { /* Shared status/fallback. */ }
    if (typeof message === "string" && Object.hasOwn(errorKeys, message))
      throw new BankAccountRequestError(t(errorKeys[message as keyof typeof errorKeys]));
  }
  return requireBankAccountResponse(response, errors, fallback);
}

const inputKeys = {
  "Amount exceeds the bill balance": "billBalance",
  "Select distinct bills": "distinctBills",
  "Select bills in one currency with matching suppliers": "sameCurrencyBills",
  "Batch total exceeds the supported range": "batchRange",
  "Select distinct bank accounts in the same currency": "sameCurrencyAccounts",
} as const;
export function paymentFailure(error: unknown, t: Translate, fallback: string) {
  if (error instanceof BankAccountRequestError) return error.message;
  if (error instanceof RangeError && Object.hasOwn(inputKeys, error.message))
    return t(inputKeys[error.message as keyof typeof inputKeys]);
  return fallback;
}
