"use client";

import { useTranslations } from "next-intl";
import { usePresentation } from "./provider";
import { formatDateOnly } from "./dates";
import { priorityConfig, statusConfig, taskStatusConfig } from "@/app/(dashboard)/projects/[id]/project-context";

export const taskStatusKeys = { backlog: "backlog", todo: "todo", in_progress: "inProgress", in_review: "inReview", done: "done", cancelled: "cancelled" } as const;
export const billingTypeKeys = { hourly: "hourly", fixed: "fixedPrice", milestone: "milestone", non_billable: "nonBillable" } as const;
const statusKeys = { active: "active", completed: "completed", on_hold: "onHold", cancelled: "cancelled", archived: "archived" } as const;
const priorityKeys = { low: "low", medium: "medium", high: "high", urgent: "urgent" } as const;

/** Translate finite display labels only; machine values and sibling contracts stay intact. */
export function useProjectPresentation() {
  const t = useTranslations("ProjectOverview");
  const shared = useTranslations("Projects");
  const presentation = usePresentation();
  const formatHours = (minutes: number) => minutes % 60
    ? shared("hoursMinutes", { hours: Math.floor(minutes / 60), minutes: minutes % 60 })
    : shared("hours", { hours: Math.floor(minutes / 60) });
  const formatDate = (value: string | null) => value ? formatDateOnly(value, presentation) : "-";
  const formatDateShort = (value: string | null) => value ? formatDateOnly(value, presentation, { month: "short", day: "numeric" }) : "-";
  return {
    t, presentation, formatHours, formatDate, formatDateShort,
    statusConfig: Object.fromEntries(Object.entries(statusConfig).map(([value, config]) => [value, { ...config, label: shared(statusKeys[value as keyof typeof statusKeys]) }])),
    priorityConfig: Object.fromEntries(Object.entries(priorityConfig).map(([value, config]) => [value, { ...config, label: shared(priorityKeys[value as keyof typeof priorityKeys]) }])),
    taskStatusConfig: Object.fromEntries(Object.entries(taskStatusConfig).map(([value, config]) => [value, { ...config, label: t(taskStatusKeys[value as keyof typeof taskStatusKeys]) }])),
    billingLabel: (value: string) => Object.hasOwn(billingTypeKeys, value) ? shared(billingTypeKeys[value as keyof typeof billingTypeKeys]) : t("unknown"),
  };
}
