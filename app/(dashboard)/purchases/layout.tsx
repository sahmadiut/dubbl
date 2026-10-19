"use client";

import { useTranslations } from "next-intl";
import { Receipt, CreditCard, ClipboardList, ClipboardCheck, PackageOpen, Undo2, PackageCheck, Repeat } from "lucide-react";
import { TabLayout } from "@/components/dashboard/tab-layout";

export default function PurchasesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = useTranslations("PurchasingNavigation");
  const tabs = [
    { href: "/purchases", label: t("bills"), icon: Receipt, exact: true },
    { href: "/purchases/bills/recurring", label: t("recurringBills"), icon: Repeat, title: t("recurringBillsHint") },
    { href: "/purchases/debit-notes", label: t("supplierCredits"), icon: Undo2, title: t("supplierCreditsHint") },
    { href: "/purchases/expenses", label: t("expenses"), icon: CreditCard },
    { href: "/purchases/orders", label: t("purchaseOrders"), icon: ClipboardList },
    { href: "/purchases/goods-receipts", label: t("goodsReceived"), icon: PackageCheck, title: t("goodsReceivedHint") },
    { href: "/purchases/requisitions", label: t("requisitions"), icon: ClipboardCheck },
    { href: "/purchases/landed-costs", label: t("landedCosts"), icon: PackageOpen, title: t("landedCostsHint") },
  ];
  return <TabLayout tabs={tabs}>{children}</TabLayout>;
}
