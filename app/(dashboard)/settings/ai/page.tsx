"use client";

import { useTranslations } from "next-intl";
import { useDocumentTitle } from "@/lib/hooks/use-document-title";
import { AiManagement } from "@/components/ai/management";
import { AiUsageSettings } from "@/components/ai/usage-settings";

export default function AiOrganizationSettingsPage() {
  const t = useTranslations("AiManagement");
  useDocumentTitle(t("title"));
  return <div className="min-w-0 space-y-10"><AiManagement /><AiUsageSettings /></div>;
}
