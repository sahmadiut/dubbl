"use client";

import { useTranslations } from "next-intl";

import { ArrowLeftRight, BookOpen, Landmark, Building2, PiggyBank, HandCoins, Scale, CalendarRange, Repeat, Layers } from "lucide-react";
import { TabLayout } from "@/components/dashboard/tab-layout";

export default function AccountingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = useTranslations("Accounts");
  const TABS = [
    { href: "/accounting", label: t("transactions"), icon: ArrowLeftRight, exact: true },
    { href: "/accounting/accounts", label: t("accounts"), icon: BookOpen },
    { href: "/accounting/banking", label: t("banking"), icon: Landmark },
    { href: "/accounting/loans", label: t("loans"), icon: HandCoins, title: t("loanHint") },
    { href: "/accounting/fixed-assets", label: t("fixedAssets"), icon: Building2 },
    { href: "/accounting/asset-categories", label: t("assetCategories"), icon: Layers, title: t("assetCategoryHint") },
    { href: "/accounting/budgets", label: t("budgets"), icon: PiggyBank },
    { href: "/accounting/opening-balances", label: t("openingBalances"), icon: Scale, title: t("openingBalanceHint") },
    { href: "/accounting/accruals", label: t("accruals"), icon: CalendarRange, title: t("accrualHint") },
    { href: "/accounting/recurring-journals", label: t("recurringJournals"), icon: Repeat, title: t("recurringJournalHint") },
  ];
  return <TabLayout tabs={TABS}>{children}</TabLayout>;
}
