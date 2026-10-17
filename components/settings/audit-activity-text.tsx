"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { auditActionLabel, auditEntityLabel } from "@/i18n/audit-presentation";

export function AuditActivityText({ userName, action, entityType, icon }: {
  userName: string; action: string; entityType: string; icon?: ReactNode;
}) {
  const t = useTranslations("SettingsAudit");
  return <>{t.rich("activity", {
    user: userName, action: auditActionLabel(t, action), entity: auditEntityLabel(t, entityType),
    strong: text => <span className="font-medium">{text}</span>,
    em: text => <span className="inline-flex items-center gap-1">{icon}<span className="text-muted-foreground">{text}</span></span>,
  })}</>;
}
