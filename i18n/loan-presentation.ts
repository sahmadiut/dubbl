import type { useTranslations } from "next-intl";
import { assetLoanJson } from "@/lib/money/asset-loan-ui";

type Translate = ReturnType<typeof useTranslations<"Loans">>;
const statuses = { active: "active", paid_off: "paidOff", defaulted: "defaulted" } as const;
export function loanStatusLabel(t: Translate, value: string) {
  return Object.hasOwn(statuses, value) ? t(statuses[value as keyof typeof statuses]) : value;
}

const inputs = {
  "Enter a nonnegative amount with at most two decimal places": "amountInvalid",
  "Enter a nonnegative amount with at most two decimal places within the supported range": "amountRange",
  "Enter a whole useful life in months from 1 to 2147483647": "termInvalid",
  "Enter a depreciation rate from 0% to 1000% with at most two decimal places": "rateInvalid",
} as const;
export class LoanRequestError extends Error {}

function isLoan(value: unknown) {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return ["id", "name", "status", "startDate"].every(key => typeof row[key] === "string")
    && ["principalAmount", "monthlyPayment", "interestRate", "termMonths"].every(key => Number.isSafeInteger(row[key]));
}

/** Translate failures without exposing arbitrary server prose; keep exact-money validation. */
export async function loanJson(response: Response, t: Translate, fallback: string, expected: "list" | "detail" | "loan" | "banks" | "payment") {
  if (!response.ok) {
    let code: unknown;
    try { code = (await response.json())?.code; } catch { /* Use status or operation fallback. */ }
    throw new LoanRequestError(response.status === 401 ? t("unauthenticated")
      : response.status === 403 ? t("forbidden")
      : code === "LEGACY_NUMERIC_RANGE" ? t("invalidMoney")
      : response.status === 400 || response.status === 422 ? t("invalidInput") : fallback);
  }
  const body = await assetLoanJson(response);
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Invalid loan response");
  if (expected === "list" || expected === "banks") {
    const rows = expected === "list" ? body.data : body.bankAccounts;
    if (!Array.isArray(rows) || rows.some(row => expected === "list" ? !isLoan(row) : !row || typeof row.id !== "string" || typeof row.accountName !== "string" || typeof row.currencyCode !== "string")) throw new Error("Invalid loan collection");
  } else if (expected === "loan" || expected === "detail") {
    if (!isLoan(body.loan)) throw new Error("Invalid loan response");
    if (expected === "detail" && (!Array.isArray(body.schedule) || body.schedule.some((row: unknown) => !isScheduleEntry(row)))) throw new Error("Invalid loan schedule");
  } else if (!isScheduleEntry(body.entry)) throw new Error("Invalid loan payment");
  return body;
}

function isScheduleEntry(value: unknown) {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return typeof row.id === "string" && typeof row.posted === "boolean"
    && ["periodNumber", "principalAmount", "interestAmount", "totalPayment", "remainingBalance"].every(key => Number.isSafeInteger(row[key]));
}

export function loanFailureMessage(error: unknown, t: Translate, fallback: string) {
  if (error instanceof LoanRequestError) return error.message;
  if (error instanceof RangeError && Object.hasOwn(inputs, error.message)) return t(inputs[error.message as keyof typeof inputs]);
  return fallback;
}
