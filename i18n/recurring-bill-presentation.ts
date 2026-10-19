import type { useTranslations } from "next-intl";
import { ZodError } from "zod";

export type RecurringBillTranslate = ReturnType<typeof useTranslations<"RecurringBills">>;
export type RecurringBillError = "readFailed" | "checkAmounts" | "createFailed" | "checkDetails" |
  "occurrenceLimit" | "lineDescription" | "dateOrder" | "priceError" | "quantityError" | "lineCountError";

const frequencyKeys = { weekly: "weekly", fortnightly: "fortnightly", monthly: "monthly", quarterly: "quarterly", semi_annual: "semiAnnual", annual: "annual" } as const;
const statusKeys = { active: "active", paused: "paused", completed: "completed" } as const;

export function recurringBillFrequencyLabel(t: RecurringBillTranslate, code: string) {
  return Object.hasOwn(frequencyKeys, code) ? t(frequencyKeys[code as keyof typeof frequencyKeys]) : code;
}

export function recurringBillStatusLabel(t: RecurringBillTranslate, code: string) {
  return Object.hasOwn(statusKeys, code) ? t(statusKeys[code as keyof typeof statusKeys]) : code;
}

/** Only reviewed local input failures become specific display messages. */
export function recurringBillInputError(error: unknown): RecurringBillError {
  if (error instanceof ZodError) {
    return error.issues.some(issue => issue.code === "custom" && issue.message === "endDate must be on or after startDate")
      ? "dateOrder" : "checkDetails";
  }
  if (!(error instanceof Error)) return "checkDetails";
  switch (error.message) {
    case "Enter a positive whole occurrence limit": return "occurrenceLimit";
    case "Add a description for every line": return "lineDescription";
    case "Enter a decimal price with at most 18 fractional digits": return "priceError";
    case "Enter a valid decimal quantity": return "quantityError";
    case "Add between 1 and 1000 invoice lines": return "lineCountError";
    default: return "checkDetails";
  }
}
