import type { useTranslations } from "next-intl";

export type JournalTranslate = ReturnType<typeof useTranslations<"Journals">>;
type ErrorTranslate = ReturnType<typeof useTranslations<"JournalErrors">>;

/** Translate only approved validation copy; never expose arbitrary parser prose. */
export function journalPreviewMessage(t: JournalTranslate, message: string) {
  switch (message) {
    case "Select an account for every amount": return t("selectAccountError");
    case "Use either debit or credit on each line": return t("oneSidedError");
    case "Journal amount exceeds the supported range":
    case "Minor-unit overflow": return t("rangeError");
    case "Fractional minor unit requires rounding": return t("precisionError");
    default: return t("amountError");
  }
}

const errorKeys = {
  "Not found": "missing",
  "Entry not found": "missing",
  "Recurring journal not found": "missingRecurring",
  "Only draft entries can be deleted": "deleteDraftOnly",
  "Only draft entries can be edited": "editDraftOnly",
  "Only draft entries can be posted": "postDraftOnly",
  "Only posted entries can be voided": "voidPostedOnly",
  "This entry has already been reversed": "alreadyReversed",
  "Entry has already been reversed": "alreadyReversed",
  "Entry changed before edit": "changed",
  "Entry changed before deletion": "changed",
  "Entry changed before posting": "changed",
  "Entry changed before reversal": "changed",
  "Cannot toggle a completed template": "completed",
  "Journal contains an account outside this organization": "accountScope",
  "Total debits must equal total credits": "balance",
  "Opening balances must have non-zero amounts": "nonzero",
} as const;

export class JournalRequestError extends Error {}

export async function requireJournalResponse(response: Response, t: ErrorTranslate, fallback: string) {
  if (!response.ok) {
    let message: unknown;
    try { message = (await response.json()).error; } catch { /* Use status/fallback. */ }
    let display = fallback;
    if (typeof message === "string" && Object.hasOwn(errorKeys, message)) display = t(errorKeys[message as keyof typeof errorKeys]);
    else if (response.status === 401) display = t("unauthenticated");
    else if (response.status === 403) display = t("forbidden");
    else if (response.status === 400 || response.status === 422) display = t("invalidInput");
    throw new JournalRequestError(display);
  }
  return response;
}

export function journalFailureMessage(error: unknown, fallback: string) {
  return error instanceof JournalRequestError ? error.message : fallback;
}
