import type { useTranslations } from "next-intl";

export type RecurringInvoiceTranslate = ReturnType<typeof useTranslations<"RecurringInvoices">>;
export type RecurringInvoiceReadError = "readFailed" | "moreFailed" | "previewFailed" | "updateReadFailed";
const frequencyKeys = { weekly: "weekly", fortnightly: "fortnightly", monthly: "monthly", quarterly: "quarterly", semi_annual: "semiAnnual", annual: "annual" } as const;
const statusKeys = { active: "active", paused: "paused", completed: "completed" } as const;

export function recurringInvoiceFrequencyLabel(t: RecurringInvoiceTranslate, code: string) {
  return Object.hasOwn(frequencyKeys, code) ? t(frequencyKeys[code as keyof typeof frequencyKeys]) : code;
}

export function recurringInvoiceStatusLabel(t: RecurringInvoiceTranslate, code: string) {
  return Object.hasOwn(statusKeys, code) ? t(statusKeys[code as keyof typeof statusKeys]) : code;
}
