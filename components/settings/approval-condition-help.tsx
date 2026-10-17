"use client";

import { useTranslations } from "next-intl";

export function ApprovalConditionHelp({ entityType, hasConditions }: { entityType: string; hasConditions: boolean }) {
  const t = useTranslations("SettingsApprovals");
  return <p className="text-xs text-muted-foreground">{hasConditions ? t("conditionHelp") : t("allEntities", { entity: entityType })}</p>;
}
