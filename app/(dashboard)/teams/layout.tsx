"use client";

import { useTranslations } from "next-intl";

import { LayoutDashboard, Users } from "lucide-react";
import { TabLayout } from "@/components/dashboard/tab-layout";

export default function TeamsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = useTranslations("Teams");
  const TABS = [
    { href: "/teams", label: t("teams"), icon: LayoutDashboard, exact: true },
    { href: "/teams/members", label: t("members"), icon: Users },
  ];

  return <TabLayout tabs={TABS}>{children}</TabLayout>;
}
