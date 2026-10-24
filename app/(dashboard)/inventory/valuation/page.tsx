"use client";

import { BidiText, IdentifierText } from "@/components/ui/bidi-text";
import { formatExactCurrencyDecimal } from "@/i18n/numbers";
import { usePresentation as useUnitPresentation } from "@/i18n/provider";

import { useTranslations } from "next-intl";
import { inventoryValuationJson, type ValuationItem, type ValuationSummary } from "@/i18n/inventory-report-presentation";
import { useState, useEffect, useCallback } from "react";
import {
  Package,
  DollarSign,
  TrendingUp,
  BarChart3,
  Download,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  Search,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import { useCreateDrawer } from "@/components/dashboard/create-drawer";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BrandLoader } from "@/components/dashboard/brand-loader";
import { ContentReveal } from "@/components/ui/content-reveal";
import { useDocumentTitle } from "@/lib/hooks/use-document-title";
import { cn } from "@/lib/utils";
import { inventoryPercent, inventoryShare, inventoryValuationMarginCompare } from "@/lib/money/inventory-ui";
import { currencyLabel } from "@/i18n/currency-labels";
import { formatExactDecimal } from "@/i18n/numbers";
import { money, toMajorDecimal } from "@/lib/money/exact";
import { motion } from "motion/react";

type SortKey =
  | "code"
  | "name"
  | "category"
  | "quantityOnHand"
  | "unitCost"
  | "carryingValue"
  | "totalCost"
  | "salePrice"
  | "totalValue"
  | "marginPercent";

const COLUMNS: { key: SortKey; label: SortKey; align?: "right" }[] = [
  { key: "code", label: "code" },
  { key: "name", label: "name" },
  { key: "category", label: "category" },
  { key: "quantityOnHand", label: "quantityOnHand", align: "right" },
  { key: "unitCost", label: "unitCost", align: "right" },
  { key: "totalCost", label: "totalCost", align: "right" },
  { key: "carryingValue", label: "carryingValue", align: "right" },
  { key: "salePrice", label: "salePrice", align: "right" },
  { key: "totalValue", label: "totalValue", align: "right" },
  { key: "marginPercent", label: "marginPercent", align: "right" },
];

export default function InventoryValuationPage() {
  const unitPresentation = useUnitPresentation();
  const t = useTranslations("InventoryReports");
  const { open: openDrawer } = useCreateDrawer();
  const [items, setItems] = useState<ValuationItem[]>([]);
  const [summary, setSummary] = useState<ValuationSummary>({
    totalItems: 0,
    totalCost: 0, totalCostMinor: "0",
    totalValue: 0, totalValueMinor: "0",
    totalMargin: 0,
    carryingValue: 0, carryingValueMinor: "0",
    currencyCode: "USD",
  });
  const [readError, setReadError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [searchQuery, setSearchQuery] = useState("");
  useDocumentTitle(t("valuationDocumentTitle"));

  const orgId =
    typeof window !== "undefined"
      ? localStorage.getItem("activeOrgId")
      : null;

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setReadError(false);
      try {
        if (!orgId) throw new Error("Organization required");
        const data = await inventoryValuationJson(await fetch("/api/v1/reports/inventory-valuation", {
          headers: { "x-organization-id": orgId },
        }));
        if (!cancelled) { setItems(data.items); setSummary(data.summary); }
      } catch { if (!cancelled) setReadError(true); }
      finally { if (!cancelled) setLoading(false); }
    }
    void load();
    return () => { cancelled = true; };
  }, [orgId]);

  const handleSort = useCallback(
    (key: SortKey) => {
      if (sortKey === key) {
        setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
      } else {
        setSortKey(key);
        setSortOrder("asc");
      }
    },
    [sortKey]
  );

  const filteredItems = items.filter((item) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      item.name.toLowerCase().includes(q) ||
      item.code.toLowerCase().includes(q) ||
      (item.category && item.category.toLowerCase().includes(q))
    );
  });

  const sortedItems = [...filteredItems].sort((a, b) => {
    if (sortKey === "marginPercent") {
      return inventoryValuationMarginCompare(a, b) * (sortOrder === "asc" ? 1 : -1);
    }
    const aVal = a[sortKey];
    const bVal = b[sortKey];
    const dir = sortOrder === "asc" ? 1 : -1;

    if (aVal == null && bVal == null) return 0;
    if (aVal == null) return 1;
    if (bVal == null) return -1;

    if (typeof aVal === "string" && typeof bVal === "string") {
      return aVal.localeCompare(bVal) * dir;
    }
    return (aVal < bVal ? -1 : aVal > bVal ? 1 : 0) * dir;
  });

  function exportCsv() {
    const headers = [
      "Code",
      "Name",
      "Category",
      "Qty On Hand",
      "Unit Cost",
      "Purchase Price Value",
      "Book Value",
      "Currency",
      "Sale Price",
      "Total Value",
      "Margin %",
    ];
    const rows = sortedItems.map((i) => [
      i.code,
      i.name,
      i.category || "",
      i.quantityOnHand,
      toMajorDecimal(money(BigInt(i.unitCostMinor), i.currencyCode)),
      toMajorDecimal(money(BigInt(i.totalCostMinor), i.currencyCode)),
      toMajorDecimal(money(BigInt(i.carryingValueMinor), i.currencyCode)),
      i.currencyCode,
      toMajorDecimal(money(BigInt(i.salePriceMinor), i.currencyCode)),
      toMajorDecimal(money(BigInt(i.totalValueMinor), i.currencyCode)),
      inventoryPercent(BigInt(i.marginMinor), BigInt(i.totalCostMinor)),
    ]);
    const csv = [headers, ...rows]
      .map((r) =>
        r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")
      )
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `inventory-valuation-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(t("csvExported"));
  }

  if (loading) return <BrandLoader />;
  if (readError) return <p role="alert">{t("valuationReadFailed")}</p>;

  const formatMoney = (amount: number | bigint) => `${currencyLabel(summary.currencyCode, unitPresentation.locale)} ${formatExactDecimal(toMajorDecimal(money(BigInt(amount), summary.currencyCode)), unitPresentation, false)}`;
  const profitAmount = BigInt(summary.totalValueMinor) - BigInt(summary.totalCostMinor);

  const stats = [
    { label: t("totalItems"), value: String(summary.totalItems), icon: Package },
    { label: t("bookValue"), value: formatMoney(BigInt(summary.carryingValueMinor)), icon: DollarSign },
    { label: t("saleProjection"), value: formatMoney(BigInt(summary.totalValueMinor)), icon: BarChart3, color: "text-emerald-600 dark:text-emerald-400" },
    {
      label: t("averageMargin"),
      value: (BigInt(summary.totalCostMinor) > 0n && profitAmount > 0n) ? `${inventoryPercent(profitAmount, BigInt(summary.totalCostMinor))}%` : "-",
      icon: TrendingUp,
      color: (BigInt(summary.totalCostMinor) > 0n && profitAmount > 0n) ? "text-emerald-600 dark:text-emerald-400" : undefined,
    },
  ];

  return (
    <ContentReveal className="space-y-6">
      <PageHeader
        title={t("valuationTitle")}
        description={t("valuationDescription")}
      >
        {items.length > 0 && (
          <div className="relative w-full sm:w-64">
            <Search className="absolute start-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("search")} aria-label={t("search")}
              className="ps-9 h-9 text-sm"
             dir="auto" />
          </div>
        )}
      </PageHeader>

      {/* Stats + margin overview */}
      <div className="grid gap-3 lg:grid-cols-[1fr_1fr]">
        {/* Left: value summary */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="rounded-xl border bg-card p-5 flex flex-col justify-between gap-4"
        >
          <div className="flex items-center justify-between flex-wrap">
            <div className="flex items-center gap-2 text-muted-foreground flex-wrap">
              <BarChart3 className="size-4" />
              <span className="text-xs font-medium uppercase tracking-wide">{t("valuationTitle")}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-[11px] gap-1.5 h-auto min-h-8 max-w-full whitespace-normal py-1.5 [overflow-wrap:anywhere]"
              onClick={exportCsv}
              disabled={items.length === 0}
            >
              <Download className="size-3" />
              {t("exportCsv")}
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">{t("purchaseValue")}</p>
              <p className="text-2xl font-bold font-mono tabular-nums whitespace-normal [overflow-wrap:anywhere]"><BidiText dir="ltr">{formatMoney(BigInt(summary.totalCostMinor))}</BidiText></p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">{t("saleProjection")}</p>
              <p className="text-2xl font-bold font-mono tabular-nums whitespace-normal [overflow-wrap:anywhere] text-emerald-600 dark:text-emerald-400"><BidiText dir="ltr">{formatMoney(BigInt(summary.totalValueMinor))}</BidiText></p>
            </div>
          </div>
          {/* Margin bar */}
          {summary.totalValue > 0 && (
            <div className="space-y-1.5">
              <div className="flex h-2 rounded-full overflow-hidden bg-muted">
                <div
                  className="bg-emerald-500 transition-all duration-500"
                  style={{ width: `${inventoryShare(BigInt(summary.totalCostMinor), BigInt(summary.totalValueMinor))}%` }}
                />
                {profitAmount > 0 && (
                  <div
                    className="bg-emerald-300 dark:bg-emerald-700 transition-all duration-500"
                    style={{ width: `${inventoryShare(profitAmount, BigInt(summary.totalValueMinor))}%` }}
                  />
                )}
              </div>
              <div className="flex items-center gap-4 text-[11px] text-muted-foreground flex-wrap">
                <span className="flex items-center gap-1.5 flex-wrap"><span className="size-2 rounded-full bg-emerald-500" /><BidiText>{t("costAmount", { amount: formatMoney(BigInt(summary.totalCostMinor)) })}</BidiText></span>
                <span className="flex items-center gap-1.5 flex-wrap"><span className="size-2 rounded-full bg-emerald-300 dark:bg-emerald-700" /><BidiText>{t("profitAmount", { amount: formatMoney(profitAmount) })}</BidiText></span>
              </div>
            </div>
          )}
        </motion.div>

        {/* Right: key metric cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.05 + i * 0.04 }}
              className="rounded-xl border bg-card p-4 flex flex-col justify-between"
            >
              <div className={cn(
                "flex size-8 items-center justify-center rounded-lg",
                stat.color ? "bg-emerald-50 dark:bg-emerald-950/40" : "bg-muted"
              )}>
                <stat.icon className={cn("size-4", stat.color || "text-muted-foreground")} />
              </div>
              <div className="mt-3">
                <p className={cn("text-2xl font-bold font-mono tabular-nums whitespace-normal [overflow-wrap:anywhere]", stat.color)}>
                  {stat.value}
                </p>
                <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide mt-0.5">
                  {stat.label}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Table */}
      {items.length === 0 ? (
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="bg-muted/30 px-5 py-3 border-b flex items-center justify-between flex-wrap">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("preview")}</p>
            <Button
              onClick={() => openDrawer("inventory")}
              size="sm"
              className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 h-auto min-h-8 max-w-full whitespace-normal py-1.5 [overflow-wrap:anywhere]"
            >
              <Plus className="me-1.5 size-3" />
              {t("addItem")}
            </Button>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-xs text-muted-foreground">
                <th className="px-4 py-3 text-start font-medium">{t("item")}</th>
                <th className="px-4 py-3 text-end font-medium">{t("quantity")}</th>
                <th className="px-4 py-3 text-end font-medium">{t("cost")}</th>
                <th className="px-4 py-3 text-end font-medium">{t("retail")}</th>
                <th className="px-4 py-3 text-end font-medium">{t("margin")}</th>
              </tr>
            </thead>
            <tbody className="text-muted-foreground/40">
              {[
                { name: t("sampleWidget"), code: "WDG-001", qty: 120, cost: (unitPresentation.locale === "en-US" ? "$4.50" : formatExactCurrencyDecimal("4.50", "USD", unitPresentation)), retail: (unitPresentation.locale === "en-US" ? "$9.99" : formatExactCurrencyDecimal("9.99", "USD", unitPresentation)), margin: "55%" },
                { name: t("sampleGadget"), code: "GDG-042", qty: 45, cost: (unitPresentation.locale === "en-US" ? "$22.00" : formatExactCurrencyDecimal("22.00", "USD", unitPresentation)), retail: (unitPresentation.locale === "en-US" ? "$39.99" : formatExactCurrencyDecimal("39.99", "USD", unitPresentation)), margin: "45%" },
                { name: t("sampleCable"), code: "CBL-100", qty: 300, cost: (unitPresentation.locale === "en-US" ? "$1.20" : formatExactCurrencyDecimal("1.20", "USD", unitPresentation)), retail: (unitPresentation.locale === "en-US" ? "$4.99" : formatExactCurrencyDecimal("4.99", "USD", unitPresentation)), margin: "76%" },
              ].map(({ name, code, qty, cost, retail, margin }) => (
                <tr key={code} className="border-b last:border-0">
                  <td className="px-4 py-3">
                    <p className="text-sm">{name}</p>
                    <p className="text-[11px] font-mono">{code}</p>
                  </td>
                  <td className="px-4 py-3 text-end font-mono">{qty}</td>
                  <td className="px-4 py-3 text-end font-mono">{cost}</td>
                  <td className="px-4 py-3 text-end font-mono">{retail}</td>
                  <td className="px-4 py-3 text-end font-mono">{margin}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="border-t px-5 py-4 text-center">
            <p className="text-sm text-muted-foreground">
              {t("previewHelp")}
            </p>
          </div>
        </div>
      ) : sortedItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="mx-auto flex size-10 items-center justify-center rounded-xl bg-muted mb-3">
            <Package className="size-5 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-muted-foreground">
            {t("noMatches")}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border bg-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                {COLUMNS.map((col) => (
                  <th
                    key={col.key}
                    className={cn(
                      "px-4 py-3 text-xs font-medium text-muted-foreground cursor-pointer select-none whitespace-nowrap hover:text-foreground transition-colors",
                      col.align === "right" ? "text-end" : "text-start"
                    )}
                    onClick={() => handleSort(col.key)}
                  >
                    <span className="inline-flex items-center gap-1 flex-wrap">
                      {t(col.label)}
                      {sortKey === col.key ? (
                        sortOrder === "asc" ? (
                          <ChevronUp className="size-3" />
                        ) : (
                          <ChevronDown className="size-3" />
                        )
                      ) : (
                        <ArrowUpDown className="size-3 opacity-30" />
                      )}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedItems.map((item) => (
                <tr
                  key={item.id}
                  className="border-b last:border-b-0 hover:bg-muted/40 transition-colors"
                >
                  <td className="px-4 py-3 font-mono text-xs">
                    <IdentifierText>{item.code}</IdentifierText>
                  </td>
                  <td className="px-4 py-3 font-medium"><BidiText>{item.name}</BidiText></td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {item.category || "-"}
                  </td>
                  <td className="px-4 py-3 text-end font-mono tabular-nums">
                    <BidiText>{item.quantityOnHand}</BidiText>
                  </td>
                  <td className="px-4 py-3 text-end font-mono tabular-nums">
                    <BidiText dir="ltr">{formatMoney(BigInt(item.unitCostMinor))}</BidiText>
                  </td>
                  <td className="px-4 py-3 text-end font-mono tabular-nums">
                    <BidiText dir="ltr">{formatMoney(BigInt(item.totalCostMinor))}</BidiText>
                  </td>
                  <td className="px-4 py-3 text-end font-mono tabular-nums">
                    <BidiText dir="ltr">{formatMoney(BigInt(item.carryingValueMinor))}</BidiText>
                  </td>
                  <td className="px-4 py-3 text-end font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                    <BidiText dir="ltr">{formatMoney(BigInt(item.salePriceMinor))}</BidiText>
                  </td>
                  <td className="px-4 py-3 text-end font-mono tabular-nums font-medium">
                    <BidiText dir="ltr">{formatMoney(BigInt(item.totalValueMinor))}</BidiText>
                  </td>
                  <td
                    className={cn(
                      "px-4 py-3 text-end font-mono tabular-nums",
                      (BigInt(item.totalCostMinor) > 0n && BigInt(item.marginMinor) > 0n)
                        ? "text-emerald-600 dark:text-emerald-400"
                        : (BigInt(item.totalCostMinor) > 0n && BigInt(item.marginMinor) < 0n)
                          ? "text-red-600 dark:text-red-400"
                          : "text-muted-foreground"
                    )}
                  >
                    {inventoryPercent(BigInt(item.marginMinor), BigInt(item.totalCostMinor))}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </ContentReveal>
  );
}
