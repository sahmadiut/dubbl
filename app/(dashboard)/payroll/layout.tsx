"use client";

import {
  LayoutDashboard,
  Users,
  FileText,
  Clock,
  Briefcase,
  BarChart3,
  DollarSign,
  Settings,
  Landmark,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { TabLayout } from "@/components/dashboard/tab-layout";
export default function PayrollLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = useTranslations("PayrollOverview");
  const tabs = [
    { href: "/payroll", label: t("overview"), icon: LayoutDashboard, exact: true },
    { href: "/payroll/employees", label: t("employees"), icon: Users },
    { href: "/payroll/runs", label: t("runs"), icon: FileText },
    { href: "/payroll/tax-liabilities", label: t("taxLiabilities"), icon: Landmark, title: t("taxLiabilitiesHelp") },
    { href: "/payroll/time-leave", label: t("timeLeave"), icon: Clock },
    { href: "/payroll/contractors", label: t("contractors"), icon: Briefcase },
    { href: "/payroll/compensation", label: t("compensation"), icon: DollarSign },
    { href: "/payroll/analytics", label: t("analytics"), icon: BarChart3 },
    { href: "/payroll/settings", label: t("settings"), icon: Settings },
  ];
  return <TabLayout tabs={tabs}>{children}</TabLayout>;
}
