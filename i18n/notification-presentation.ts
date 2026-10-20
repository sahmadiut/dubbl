import type { useTranslations } from "next-intl";
import type { Presentation } from "./locale";
import { formatInstant } from "./dates";

type Translate = ReturnType<typeof useTranslations<"Notifications">>;

function dateLabel(presentation: Presentation, date: Date, month: "short" | "long") {
  return formatInstant(date, presentation, { month, day: "numeric" });
}

export function notificationRelativeTime(t: Translate, presentation: Presentation, value: string, now = new Date()) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return t("unknownDate");
  const minutes = Math.floor((now.getTime() - date.getTime()) / 60000);
  if (minutes < 1) return t("justNow");
  if (minutes < 60) return t("minutesAgo", { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t("hoursAgo", { count: hours });
  const days = Math.floor(hours / 24);
  if (days < 7) return t("daysAgo", { count: days });
  return dateLabel(presentation, date, "short");
}

export function groupNotifications<T extends { createdAt: string }>(t: Translate, presentation: Presentation, notifications: T[], now = new Date()) {
  // Group by a canonical local Gregorian day, never by a translated label.
  const dayFormat = new Intl.DateTimeFormat("en-CA", {
    timeZone: presentation.timeZone, calendar: "gregory", numberingSystem: "latn",
    year: "numeric", month: "2-digit", day: "2-digit",
  });
  const dayKey = (date: Date) => {
    const parts = dayFormat.formatToParts(date);
    return ["year", "month", "day"].map(type => parts.find(part => part.type === type)!.value).join("-");
  };
  const today = dayKey(now);
  const yesterday = new Date(today + "T12:00:00Z");
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const yesterdayKey = yesterday.toISOString().slice(0, 10);
  const groups = new Map<string, { key: string; label: string; items: T[] }>();
  for (const notification of notifications) {
    const date = new Date(notification.createdAt);
    const valid = Number.isFinite(date.getTime());
    const key = valid ? dayKey(date) : "unknown";
    const label = !valid ? t("unknownDate") : key === today ? t("today")
      : key === yesterdayKey ? t("yesterday") : dateLabel(presentation, date, "long");
    if (!groups.has(key)) groups.set(key, { key, label, items: [] });
    groups.get(key)!.items.push(notification);
  }
  return [...groups.values()];
}
