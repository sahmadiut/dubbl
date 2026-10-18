import type { useTranslations } from "next-intl";

export type CreditNoteTranslate = ReturnType<typeof useTranslations<"CreditNotes">>;
const statuses = { draft: "draft", sent: "sent", applied: "used", void: "cancelled" } as const;

export function creditNoteStatusLabel(t: CreditNoteTranslate, code: string) {
  return Object.hasOwn(statuses, code) ? t(statuses[code as keyof typeof statuses]) : code;
}
