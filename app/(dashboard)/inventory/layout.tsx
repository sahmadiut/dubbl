"use client";

import { useTranslations } from "next-intl";
import { Package, ClipboardList, Warehouse, BarChart3, ArrowLeftRight } from "lucide-react";
import { TabLayout } from "@/components/dashboard/tab-layout";

const TABS = [
  { href: "/inventory", label: "items", icon: Package, exact: true },
  { href: "/inventory/stock-takes", label: "stocktakes", icon: ClipboardList },
  { href: "/inventory/warehouses", label: "locations", icon: Warehouse },
  { href: "/inventory/transfers", label: "transfers", icon: ArrowLeftRight },
  { href: "/inventory/valuation", label: "stockValue", icon: BarChart3 },
] as const;

export default function InventoryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = useTranslations("InventoryNavigation");
  return <TabLayout tabs={TABS.map(tab => ({ ...tab, label: t(tab.label) }))}>{children}</TabLayout>;
}
