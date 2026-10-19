import type { useTranslations } from "next-intl";

export type RequisitionTranslate = ReturnType<typeof useTranslations<"Requisitions">>;
const statuses = { draft: "draft", submitted: "submitted", approved: "approved", rejected: "rejected", converted: "converted" } as const;

export function requisitionStatusLabel(t: RequisitionTranslate, code: string) {
  return Object.hasOwn(statuses, code) ? t(statuses[code as keyof typeof statuses]) : code;
}
