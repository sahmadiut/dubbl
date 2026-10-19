import type { useTranslations } from "next-intl";

export type DebitNoteTranslate = ReturnType<typeof useTranslations<"DebitNotes">>;
const statuses = { draft: "draft", sent: "sent", applied: "used", void: "cancelled" } as const;

export function debitNoteStatusLabel(t: DebitNoteTranslate, code: string) {
  return Object.hasOwn(statuses, code) ? t(statuses[code as keyof typeof statuses]) : code;
}
