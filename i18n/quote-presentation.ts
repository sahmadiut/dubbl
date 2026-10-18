import type { useTranslations } from "next-intl";

export type QuoteTranslate = ReturnType<typeof useTranslations<"SalesQuotes">>;
const statuses = {
  draft: "draft", sent: "sent", accepted: "accepted", declined: "declined",
  expired: "expired", converted: "converted",
} as const;

export function quoteStatusLabel(t: QuoteTranslate, code: string) {
  return Object.hasOwn(statuses, code) ? t(statuses[code as keyof typeof statuses]) : code;
}
