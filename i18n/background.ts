import { createTranslator } from "next-intl";
import en from "@/messages/en-US.json";
import fa from "@/messages/fa-IR.json";
import type { AppLocale } from "./locale";

/** Internal output locale only; existing workers retain English until recipient delivery is qualified. */
export function backgroundTranslator(locale: AppLocale = "en-US") {
  return createTranslator({ locale, messages: locale === "fa-IR" ? fa : en, namespace: "Background" });
}

export function digestTime(date: Date, now = new Date(), locale: AppLocale = "en-US") {
  const t = backgroundTranslator(locale);
  const minutes = Math.floor((now.getTime() - date.getTime()) / 60000);
  if (minutes < 60) return t("minutesAgo", { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t("hoursAgo", { count: hours });
  return date.toLocaleDateString(locale, { month: "short", day: "numeric" });
}

export function scheduledReportEmail(name: string, frequency: string, format: string, locale: AppLocale = "en-US") {
  const t = backgroundTranslator(locale);
  const frequencyLabel = frequency === "daily" ? t("daily") : frequency === "weekly" ? t("weekly") : frequency === "monthly" ? t("monthly") : frequency;
  const subject = t("reportSubject", { name });
  const body = t("reportBody", { frequency: frequencyLabel, format });
  const escape = (text: string) => text.replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);
  return { subject, html: `<h2>${escape(subject)}</h2><p>${escape(body)}</p>` };
}
