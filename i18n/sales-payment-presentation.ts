import type { useTranslations } from "next-intl";

export type SalesPaymentTranslate = ReturnType<typeof useTranslations<"SalesPayments">>;

const methodKeys = {
  bank_transfer: "bankTransfer", cash: "cash", check: "check", card: "card", other: "other",
} as const;
const documentKeys = {
  invoice: "invoice", bill: "bill", credit_note: "creditNote", debit_note: "debitNote", prepayment: "prepayment",
} as const;

/** Labels only: canonical values, caller content and future codes stay unchanged. */
export function salesPaymentMethodLabel(t: SalesPaymentTranslate, value: string, detail = false) {
  if (detail && value === "bank_transfer") return t("bankTransferDetail");
  return Object.hasOwn(methodKeys, value) ? t(methodKeys[value as keyof typeof methodKeys]) : value;
}

export function salesPaymentDocumentLabel(t: SalesPaymentTranslate, value: string) {
  return Object.hasOwn(documentKeys, value) ? t(documentKeys[value as keyof typeof documentKeys]) : value;
}
