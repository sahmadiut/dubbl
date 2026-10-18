import type { useTranslations } from "next-intl";

export type RevenueScheduleTranslate = ReturnType<typeof useTranslations<"RevenueSchedules">>;
export type RevenueReadError = "readFailed" | "moreFailed" | "refreshFailed";
const statusKeys = { active: "active", completed: "completed", cancelled: "cancelled" } as const;
const methodKeys = { straight_line: "straightLine", milestone: "milestone", on_completion: "onCompletion" } as const;

export function revenueStatusLabel(t: RevenueScheduleTranslate, code: string) {
  return Object.hasOwn(statusKeys, code) ? t(statusKeys[code as keyof typeof statusKeys]) : code;
}
export function revenueMethodLabel(t: RevenueScheduleTranslate, code: string) {
  return Object.hasOwn(methodKeys, code) ? t(methodKeys[code as keyof typeof methodKeys]) : code;
}

/** Validate before rendering legacy numeric cents or adopting a malformed read. */
export function revenueScheduleValid(value: unknown, detail = false): boolean {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  if (typeof row.id !== "string" || !row.id.trim() ||
      ![row.startDate, row.endDate, row.method, row.status].every(v => typeof v === "string")) return false;
  for (const field of ["totalAmount", "recognizedAmount"]) {
    if (!Number.isSafeInteger(row[field]) || Number(row[field]) < 0) return false;
    if (row[`${field}Minor`] !== undefined && row[`${field}Minor`] !== String(row[field])) return false;
  }
  if (detail && !Array.isArray(row.entries)) return false;
  if (row.entries !== undefined && (!Array.isArray(row.entries) || !row.entries.every((entry: unknown) => {
    if (!entry || typeof entry !== "object") return false;
    const e = entry as Record<string, unknown>;
    return typeof e.id === "string" && !!e.id.trim() && typeof e.periodDate === "string" &&
      typeof e.recognized === "boolean" && Number.isSafeInteger(e.amount) && Number(e.amount) >= 0 &&
      (e.amountMinor === undefined || e.amountMinor === String(e.amount));
  }))) return false;
  return true;
}
