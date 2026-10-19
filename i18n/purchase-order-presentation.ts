import type { useTranslations } from "next-intl";

export type PurchaseOrderTranslate = ReturnType<typeof useTranslations<"PurchaseOrders">>;
const statuses = { draft: "draft", sent: "sent", partial: "partial", received: "received", closed: "closed", void: "void" } as const;

export function purchaseOrderStatusLabel(t: PurchaseOrderTranslate, code: string) {
  return Object.hasOwn(statuses, code) ? t(statuses[code as keyof typeof statuses]) : code;
}
