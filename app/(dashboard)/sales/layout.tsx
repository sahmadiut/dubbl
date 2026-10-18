"use client";
import { useTranslations } from "next-intl";

import { FileText, ScrollText, CreditCard, RefreshCw, Banknote, Wallet, CalendarClock, Coins } from "lucide-react";
import { TabLayout } from "@/components/dashboard/tab-layout";

export default function SalesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = useTranslations("SalesNavigation");
  const tabs = [
    { href: "/sales", label: t("invoices"), icon: FileText, exact: true },
    { href: "/sales/quotes", label: t("quotes"), icon: ScrollText },
    { href: "/sales/receipts", label: t("cashSales"), icon: Banknote },
    { href: "/sales/credit-notes", label: t("creditNotes"), icon: CreditCard },
    { href: "/sales/payments", label: t("payments"), icon: Coins, title: t("paymentsHint") },
    { href: "/sales/customer-prepayments", label: t("prepayments"), icon: Wallet, title: t("prepaymentsHint") },
    { href: "/sales/revenue-schedules", label: t("revenueSchedules"), icon: CalendarClock, title: t("revenueSchedulesHint") },
    { href: "/sales/recurring", label: t("recurring"), icon: RefreshCw },
  ];
  return <TabLayout tabs={tabs}>{children}</TabLayout>;
}
