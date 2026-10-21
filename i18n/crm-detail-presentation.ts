"use client";

import { useTranslations } from "next-intl";
import { usePresentation } from "./provider";
import { formatDateOnly, formatInstant } from "./dates";
import { crmActivityKeys, crmSourceKeys } from "./crm-presentation";

export function useCrmDetailPresentation() {
  const t = useTranslations("CrmDetail");
  const sources = useTranslations("CrmPipeline");
  const presentation = usePresentation();
  const formatDate = (value: string) => formatDateOnly(value, presentation, { year: "numeric", month: "long", day: "numeric" });
  const formatTime = (value: string) => formatInstant(new Date(value), presentation, { year: "numeric", month: "long", day: "numeric" });
  const timeAgo = (value: string) => {
    const seconds = Math.max(0, Math.floor((Date.now() - Date.parse(value)) / 1000));
    if (seconds < 60) return t("justNow");
    if (seconds < 3600) return t("minutesAgo", { count: Math.floor(seconds / 60) });
    if (seconds < 86400) return t("hoursAgo", { count: Math.floor(seconds / 3600) });
    if (seconds < 2592000) return t("daysAgo", { count: Math.floor(seconds / 86400) });
    return formatInstant(new Date(value), presentation, { month: "short", day: "numeric" });
  };
  return { t, formatDate, formatTime, timeAgo,
    sourceLabel: (value: string | null) => value && Object.hasOwn(crmSourceKeys, value) ? sources(crmSourceKeys[value as keyof typeof crmSourceKeys]) : "-",
    activityLabel: (value: string) => Object.hasOwn(crmActivityKeys, value) ? t(crmActivityKeys[value as keyof typeof crmActivityKeys]) : t("unknown"),
  };
}
