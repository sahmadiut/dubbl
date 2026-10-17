"use client";

import { useTranslations } from "next-intl";

export type ApprovalEntity = "bill" | "expense" | "invoice" | "journal_entry" | "purchase_order";

export function approvalEntityHref(req: { entityType: ApprovalEntity; entityId: string }) {
  switch (req.entityType) {
    case "bill": return `/purchases/${req.entityId}`;
    case "purchase_order": return `/purchases/orders/${req.entityId}`;
    case "expense": return `/purchases/expenses/${req.entityId}`;
    case "invoice": return `/sales/${req.entityId}`;
    case "journal_entry": return `/accounting/${req.entityId}`;
    default: return "/notifications";
  }
}

export function ApprovalNotificationTitle({ entityType }: { entityType: ApprovalEntity }) {
  const t = useTranslations("Notifications");
  const labels = {
    bill: t("bill"), expense: t("expense"), invoice: t("invoice"),
    journal_entry: t("journalEntry"), purchase_order: t("purchaseOrder"),
  };
  return t("needsApproval", { entity: labels[entityType] });
}

export function ApprovalNotificationSender({ name }: { name: string }) {
  const t = useTranslations("Notifications");
  return t("sentBy", { name });
}
