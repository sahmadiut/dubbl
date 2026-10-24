"use client";

import { BidiText } from "@/components/ui/bidi-text";

import { useTranslations } from "next-intl";
import { inventoryAlertsJson, type ReorderItem } from "@/i18n/inventory-report-presentation";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Package,
  ShoppingCart,
  AlertCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/dashboard/empty-state";
import { BrandLoader } from "@/components/dashboard/brand-loader";
import { ContentReveal } from "@/components/ui/content-reveal";
import { useCreateDrawer } from "@/components/dashboard/create-drawer";
import { useDocumentTitle } from "@/lib/hooks/use-document-title";
import { cn } from "@/lib/utils";

export default function AlertsPage() {
  const t = useTranslations("InventoryReports");
  const [readError, setReadError] = useState(false);
  const router = useRouter();
  const { open: openDrawer } = useCreateDrawer();
  const [items, setItems] = useState<ReorderItem[]>([]);
  const [loading, setLoading] = useState(true);
  useDocumentTitle(t("alertsDocumentTitle"));

  const orgId = typeof window !== "undefined" ? localStorage.getItem("activeOrgId") : null;

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setReadError(false);
      try {
        if (!orgId) throw new Error("Organization required");
        const rows = await inventoryAlertsJson(await fetch("/api/v1/inventory/reorder-suggestions", {
          headers: { "x-organization-id": orgId },
        }));
        if (!cancelled) setItems(rows);
      } catch { if (!cancelled) setReadError(true); }
      finally { if (!cancelled) setLoading(false); }
    }
    void load();
    return () => { cancelled = true; };
  }, [orgId]);

  if (loading) return <BrandLoader />;
  if (readError) return <p role="alert">{t("alertsReadFailed")}</p>;

  const criticalCount = items.filter((i) => i.quantityOnHand === 0).length;
  const lowCount = items.length;

  if (items.length === 0) {
    return (
      <ContentReveal>
        <EmptyState
          icon={AlertTriangle}
          title={t("noAlerts")}
          description={t("noAlertsDescription")}
        />
      </ContentReveal>
    );
  }

  return (
    <ContentReveal className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground flex-wrap">
            <AlertTriangle className="size-3.5 text-amber-500" />
            <span className="text-[11px] font-medium uppercase tracking-wide">{t("totalAlerts")}</span>
          </div>
          <p className="mt-2 text-2xl font-bold font-mono tabular-nums whitespace-normal [overflow-wrap:anywhere] text-amber-600 dark:text-amber-400">
            {lowCount}
          </p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground flex-wrap">
            <AlertCircle className="size-3.5 text-red-500" />
            <span className="text-[11px] font-medium uppercase tracking-wide">{t("outOfStock")}</span>
          </div>
          <p className={cn(
            "mt-2 text-2xl font-bold font-mono tabular-nums whitespace-normal [overflow-wrap:anywhere]",
            criticalCount > 0 ? "text-red-600 dark:text-red-400" : ""
          )}>
            {criticalCount}
          </p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground flex-wrap">
            <Package className="size-3.5" />
            <span className="text-[11px] font-medium uppercase tracking-wide">{t("belowReorder")}</span>
          </div>
          <p className="mt-2 text-2xl font-bold font-mono tabular-nums whitespace-normal [overflow-wrap:anywhere]">
            {lowCount - criticalCount}
          </p>
        </div>
      </div>

      {/* Alert Items */}
      <div className="rounded-xl border bg-card divide-y">
        {items.map((item) => {
          const isCritical = item.quantityOnHand === 0;
          return (
            <div
              key={item.id}
              className="group flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors flex-wrap"
            >
              <div className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-lg",
                isCritical
                  ? "bg-red-50 dark:bg-red-950/40"
                  : "bg-amber-50 dark:bg-amber-950/40"
              )}>
                <Package className={cn(
                  "size-4",
                  isCritical
                    ? "text-red-600 dark:text-red-400"
                    : "text-amber-600 dark:text-amber-400"
                )} />
              </div>
              <div
                className="flex-1 min-w-0 cursor-pointer flex-wrap"
                onClick={() => router.push(`/inventory/${item.id}`)}
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium whitespace-normal [overflow-wrap:anywhere]"><BidiText>{item.name}</BidiText></p>
                  {isCritical && (
                    <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300 text-[10px] px-1.5 py-0">
                      {t("outOfStock")}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  <BidiText>{t("alertSummary", { code: item.code, sku: item.sku ? ` · ${item.sku}` : "", quantity: item.quantityOnHand, point: item.reorderPoint })}</BidiText>
                </p>
              </div>

              {/* Suggested quantity */}
              <div className="hidden sm:flex flex-col items-end gap-0.5 w-24">
                <span className="text-xs font-mono tabular-nums font-medium"><BidiText dir="ltr">+{item.suggestedReorderQuantity}</BidiText></span>
                <span className="text-[11px] text-muted-foreground">{t("suggested")}</span>
              </div>

              {/* Supplier + PO action */}
              <div className="flex items-center gap-2 flex-wrap">
                {item.preferredSupplier && (
                  <span className="hidden md:inline text-xs text-muted-foreground whitespace-normal [overflow-wrap:anywhere] max-w-[120px]">
                    <BidiText>{item.preferredSupplier.contactName}</BidiText>
                  </span>
                )}
                <Button
                  size="sm"
                  aria-label={t("createPo")}
                  variant="outline"
                  className="h-7 text-xs gap-1 h-auto min-h-8 max-w-full whitespace-normal py-1.5 [overflow-wrap:anywhere]"
                  onClick={(e) => {
                    e.stopPropagation();
                    openDrawer("purchaseOrder");
                  }}
                >
                  <ShoppingCart className="size-3" />
                  <span className="hidden sm:inline">{t("createPo")}</span>
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </ContentReveal>
  );
}
