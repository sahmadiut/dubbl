import type { useTranslations } from "next-intl";

export type CustomerPrepaymentTranslate = ReturnType<typeof useTranslations<"CustomerPrepayments">>;
const statuses = { open: "availableStatus", applied: "usedStatus", refunded: "refundedStatus", void: "cancelledStatus" } as const;
const sources = { prepayment: "prepaymentSource", overpayment: "overpaymentSource", credit_note: "creditNoteSource" } as const;

export function customerPrepaymentStatusLabel(t: CustomerPrepaymentTranslate, code: string) {
  return Object.hasOwn(statuses, code) ? t(statuses[code as keyof typeof statuses]) : code;
}

export function customerPrepaymentSourceLabel(t: CustomerPrepaymentTranslate, code: string) {
  return Object.hasOwn(sources, code) ? t(sources[code as keyof typeof sources]) : code;
}
