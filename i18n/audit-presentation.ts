import type { useTranslations } from "next-intl";
import type { Presentation } from "./locale";

type Translate = ReturnType<typeof useTranslations<"SettingsAudit">>;

export const AUDIT_ENTITY_TYPES = ["invoice", "bill", "contact", "journal_entry", "account", "quote", "purchase_order", "bank_account", "expense", "payment", "credit_note"] as const;

export function auditActionLabel(t: Translate, action: string) {
  switch (action) {
    case "create": case "update": case "delete": case "post": case "void":
    case "approve": case "send": case "restore": case "purge": case "restore_backup":
    case "close": case "reopen": case "import": case "export": case "reject": case "comment":
      return t(`action_${action}`);
    default: return action; // Unrecognized audit codes remain inspectable technical data.
  }
}

export function auditEntityLabel(t: Translate, type: string) {
  switch (type) {
    case "invoice": case "bill": case "contact": case "journal_entry": case "account":
    case "quote": case "purchase_order": case "bank_account": case "expense": case "payment": case "credit_note":
      return t(`entity_${type}`);
    default: return type.replace(/_/g, " ");
  }
}

function dateFormat(p: Presentation, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat(p.locale, { timeZone: p.timeZone, calendar: p.calendar, numberingSystem: p.numerals, ...options });
}

export function auditRelativeTime(t: Translate, presentation: Presentation, value: string, now = new Date()) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return t("unknownDate");
  const minutes = Math.floor((now.getTime() - date.getTime()) / 60000);
  if (minutes < 1) return t("justNow");
  if (minutes < 60) return t("minutesAgo", { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t("hoursAgo", { count: hours });
  const days = Math.floor(hours / 24);
  if (days < 7) return t("daysAgo", { count: days });
  return dateFormat(presentation, { year: "numeric", month: "numeric", day: "numeric" }).format(date);
}

export function auditDayLabel(t: Translate, presentation: Presentation, value: string, now = new Date()) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return t("unknownDate");
  // Compare canonical local Gregorian days so DST and translated day labels do
  // not alter grouping. Calendar preference affects only the visible label.
  const day = dateFormat(presentation, { calendar: "gregory", numberingSystem: "latn", year: "numeric", month: "2-digit", day: "2-digit" });
  const key = (d: Date) => {
    const parts = day.formatToParts(d);
    return ["year", "month", "day"].map(type => parts.find(part => part.type === type)!.value).join("-");
  };
  const today = key(now), current = key(date);
  if (current === today) return t("today");
  const days = Math.floor((Date.parse(today) - Date.parse(current)) / 86400000);
  if (days === 1) return t("yesterday");
  return dateFormat(presentation, days > 1 && days < 7 ? { weekday: "long" } : { month: "long", day: "numeric", year: "numeric" }).format(date);
}
