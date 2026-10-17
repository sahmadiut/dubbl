import type { useTranslations } from "next-intl";

export function webhookStatusLabel(t: ReturnType<typeof useTranslations<"SettingsWebhooks">>, status: string) {
  switch (status) {
    case "pending": return t("pending");
    case "success": return t("success");
    case "failed": return t("failed");
    case "retrying": return t("retrying");
    default: return t("unknownStatus");
  }
}
