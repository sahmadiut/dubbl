import type { createTranslator } from "next-intl";
import type en from "@/messages/en-US.json";

export type ExpenseTranslator = ReturnType<typeof createTranslator<typeof en, "Expenses">>;
export type ExpenseErrorKey = "countsFailed" | "readFailed" | "moreFailed" | "detailFailed" | "currencyFailed" | "taxesFailed" | "recurringReadFailed";

const statuses = { draft: "draft", submitted: "submitted", approved: "approved", rejected: "rejected", paid: "paid", active: "active", paused: "paused", completed: "completed" } as const;
const frequencies = { weekly: "weekly", fortnightly: "fortnightly", monthly: "monthly", quarterly: "quarterly", semi_annual: "semiAnnual", annual: "annual" } as const;
const sorts = { "created:desc": "newest", "created:asc": "oldest", "total:desc": "highest", "total:asc": "lowest", "title:asc": "titleAsc", "title:desc": "titleDesc" } as const;
export function expenseStatusLabel(t: ExpenseTranslator, code: string) {
  return Object.hasOwn(statuses, code) ? t(statuses[code as keyof typeof statuses]) : code;
}
export function expenseFrequencyLabel(t: ExpenseTranslator, code: string) {
  return Object.hasOwn(frequencies, code) ? t(frequencies[code as keyof typeof frequencies]) : code;
}
export function expenseSortLabel(t: ExpenseTranslator, code: string) {
  return Object.hasOwn(sorts, code) ? t(sorts[code as keyof typeof sorts]) : code;
}

// Only reviewed local validation messages may select display copy. Never pass
// HTTP response prose here; transport failures use operation-specific fallbacks.
const inputErrors = {
  "Enter a nonnegative decimal amount (up to 18 decimal places)": "decimalError",
  "Expense amount exceeds the supported nonnegative range": "rangeError",
  "Distance exceeds the supported miles range": "distanceError",
  "Add between 1 and 1000 expense items": "itemCountError",
  "Add a description for every expense item": "itemDescriptionError",
  "Each item needs an amount greater than zero": "positiveError",
  "Load the organization currency before entering expenses": "currencyRequired",
  "Add a description and amount for every recurring expense line": "recurringLineError",
  "Recurring expense amounts must be nonnegative": "nonnegativeError",
  "Recurring expense total must be nonnegative": "nonnegativeError",
  "Enter a positive whole occurrence limit": "occurrenceError",
  "endDate must be on or after startDate": "dateOrderError",
} as const;
export function expenseInputError(error: unknown): (typeof inputErrors)[keyof typeof inputErrors] | "checkAmounts" {
  const message = typeof error === "string" ? error : error instanceof Error ? error.message : "";
  if (Object.hasOwn(inputErrors, message)) return inputErrors[message as keyof typeof inputErrors];
  if (error && typeof error === "object" && "issues" in error && Array.isArray(error.issues) && error.issues.some(issue => issue?.code === "custom" && issue?.message === "endDate must be on or after startDate")) return "dateOrderError";
  return "checkAmounts";
}
