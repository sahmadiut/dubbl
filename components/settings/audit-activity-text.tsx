"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { auditActionLabel, auditEntityLabel } from "@/i18n/audit-presentation";
import { BidiText } from "@/components/ui/bidi-text";

export function AuditActivityText({ userName, action, entityType, icon }: {
  userName: string; action: string; entityType: string; icon?: ReactNode;
}) {
  const t = useTranslations("SettingsAudit");
  return <>{t.rich("activity", {
    user: userName, action: auditActionLabel(t, action), entity: auditEntityLabel(t, entityType),
    strong: text => <BidiText className="font-medium">{text}</BidiText>,
    em: text => <span className="inline-flex max-w-full items-center gap-1">{icon}<BidiText className="min-w-0 text-muted-foreground">{text}</BidiText></span>,
  })}</>;
}
