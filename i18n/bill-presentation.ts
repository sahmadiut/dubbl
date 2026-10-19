import type { useTranslations } from "next-intl";

export type BillTranslator = ReturnType<typeof useTranslations<"SupplierBills">>;

const statusKeys = {
  draft: "draftStatus", pending_approval: "pendingStatus", received: "receivedStatus",
  partial: "partialStatus", paid: "paidStatus", overdue: "overdueStatus", void: "voidStatus",
} as const;

export function billStatusLabel(status: string, t: BillTranslator): string {
  return Object.hasOwn(statusKeys, status) ? t(statusKeys[status as keyof typeof statusKeys]) : status;
}
