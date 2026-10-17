import type { useTranslations } from "next-intl";
import { requireSettingsResponse } from "@/i18n/settings-errors";

export async function readSettingsLockDate(
  response: Response,
  errors: ReturnType<typeof useTranslations<"SettingsErrors">>,
  fallback: string,
) {
  const data = await (await requireSettingsResponse(response, errors, fallback)).json();
  if (data?.periodLock === null) return "";
  const date: unknown = data?.periodLock?.lockDate;
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Invalid period-lock response");
  return date;
}
