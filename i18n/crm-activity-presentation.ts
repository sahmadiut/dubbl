"use client";

import { useTranslations } from "next-intl";
import { usePresentation } from "./provider";
import { formatInstant } from "./dates";
import { useCrmDetailPresentation } from "./crm-detail-presentation";

const pluralKeys = { note: "notes", email: "emails", call: "calls", meeting: "meetings", task: "tasks" } as const;
const placeholderKeys = { note: "placeholder_note", email: "placeholder_email", call: "placeholder_call", meeting: "placeholder_meeting", task: "placeholder_task" } as const;
export function useCrmActivityPresentation() {
  const t = useTranslations("CrmActivity");
  const presentation = usePresentation();
  const { activityLabel, timeAgo } = useCrmDetailPresentation();
  return { t, activityLabel, timeAgo,
    pluralLabel: (type: string) => Object.hasOwn(pluralKeys, type) ? t(pluralKeys[type as keyof typeof pluralKeys]) : activityLabel(type),
    placeholder: (type: string) => t(placeholderKeys[type as keyof typeof placeholderKeys] ?? "placeholder_note"),
    dateLabel: (value: string, weekday = false) => formatInstant(new Date(value), presentation, weekday ? { weekday: "long", month: "short", day: "numeric" } : { year: "numeric", month: "long", day: "numeric" }),
    clock: (value: string) => formatInstant(new Date(value), presentation, { hour: "2-digit", minute: "2-digit" }),
    // A stable Gregorian key in the presentation timezone; labels honor the chosen calendar.
    dayKey: (value: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: presentation.timeZone, calendar: "gregory", numberingSystem: "latn", year: "numeric", month: "2-digit", day: "2-digit" }).format(value),
  };
}
