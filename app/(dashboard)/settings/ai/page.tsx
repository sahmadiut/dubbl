"use client";

import { useTranslations } from "next-intl";
import { useDocumentTitle } from "@/lib/hooks/use-document-title";
import { AiManagement } from "@/components/ai/management";

export default function AiOrganizationSettingsPage() {
  const t = useTranslations("AiManagement");
  useDocumentTitle(t("title"));
  return <AiManagement />;
}
