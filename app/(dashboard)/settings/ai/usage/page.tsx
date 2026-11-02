"use client";

import { useTranslations } from "next-intl";
import { useDocumentTitle } from "@/lib/hooks/use-document-title";
import { AiUsageDashboard } from "@/components/ai/usage-dashboard";

export default function AiUsagePage() {
  const t = useTranslations("AiDashboard");
  useDocumentTitle(t("title"));
  return <AiUsageDashboard />;
}
