import type { useTranslations } from "next-intl";

export type SalesReceiptTranslate = ReturnType<typeof useTranslations<"SalesReceipts">>;
const statuses = { draft: "draft", paid: "paid", void: "cancelled" } as const;

export function salesReceiptStatusLabel(t: SalesReceiptTranslate, code: string) {
  return Object.hasOwn(statuses, code) ? t(statuses[code as keyof typeof statuses]) : code;
}
