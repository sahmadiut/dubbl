"use client";

import { inventoryItemJson, inventoryItemRow, inventoryWriteDownError } from "@/i18n/inventory-item-presentation";
import { useTranslations } from "next-intl";

import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter, usePathname } from "next/navigation";
import { motion } from "motion/react";
import { ArrowLeft, Package, ArrowUpDown, Power, PowerOff, Settings2, Clock, Truck, Layers, TrendingDown } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { BrandLoader } from "@/components/dashboard/brand-loader";
import { ContentReveal } from "@/components/ui/content-reveal";
import { catalogWholeInput } from "@/lib/money/catalog-input";
import { inventoryDetailMoney, inventoryWriteDown } from "@/lib/money/inventory-detail-ui";
import { bankMoneyDisplay } from "@/lib/money/bank-display";
const formatMoney = (value: number | bigint) => bankMoneyDisplay(value, "USD");
import { setEntityTitle } from "@/lib/hooks/use-entity-title";
import { cn } from "@/lib/utils";

export interface InventoryItemDetail {
  id: string;
  code: string;
  name: string;
  description: string | null;
  category: string | null;
  categoryId: string | null;
  sku: string | null;
  imageUrl: string | null;
  purchasePrice: number;
  purchasePriceMinor: string;
  salePrice: number;
  salePriceMinor: string;
  quantityOnHand: number;
  reorderPoint: number;
  totalValue: number;
  totalValueMinor: string;
  priceValue: number;
  priceValueMinor: string;
  isActive: boolean;
}

interface InventoryItemContextValue {
  item: InventoryItemDetail;
  setItem: (fn: (prev: InventoryItemDetail) => InventoryItemDetail) => void;
  refetch: () => void;
}

const InventoryItemContext = createContext<InventoryItemContextValue | null>(null);

export function useInventoryItem() {
  const ctx = useContext(InventoryItemContext);
  if (!ctx) throw new Error("useInventoryItem must be used within inventory item layout");
  return ctx;
}

const PAGE_TABS = [
  { value: "details", label: "details", icon: Settings2, href: (id: string) => `/inventory/${id}` },
  { value: "history", label: "history", icon: Clock, href: (id: string) => `/inventory/${id}/history` },
  { value: "suppliers", label: "suppliers", icon: Truck, href: (id: string) => `/inventory/${id}/suppliers` },
  { value: "variants", label: "variants", icon: Layers, href: (id: string) => `/inventory/${id}/variants` },
] as const;

export default function InventoryItemLayout({ children }: { children: React.ReactNode }) {
  const { id } = useParams<{ id: string }>();
  const orgId = typeof window !== "undefined" ? localStorage.getItem("activeOrgId") : null;
  return <InventoryItemWorkspace key={`${orgId}:${id}`} id={id} orgId={orgId}>{children}</InventoryItemWorkspace>;
}

function InventoryItemWorkspace({ children, id, orgId }: { children: React.ReactNode; id: string; orgId: string | null }) {
  const t = useTranslations("InventoryItems");
  const router = useRouter();
  const pathname = usePathname();
  const [item, setItemRaw] = useState<InventoryItemDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustment, setAdjustment] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  // "Write down value" sheet: lower the book value without changing the count.
  const [writeDownOpen, setWriteDownOpen] = useState(false);
  const [writeDownAmount, setWriteDownAmount] = useState("");
  const [writeDownReason, setWriteDownReason] = useState("");
  const [writeDownBusy, setWriteDownBusy] = useState(false);

  const [readError, setReadError] = useState("");
  const readController = useRef<AbortController | null>(null);

  const fetchItem = useCallback(() => {
    readController.current?.abort();
    const controller = new AbortController();
    readController.current = controller;
    setLoading(true);
    setItemRaw(null);
    setReadError("");
    if (!orgId) { setLoading(false); return; }
    fetch(`/api/v1/inventory/${id}`, {
      headers: { "x-organization-id": orgId }, signal: controller.signal,
    })
      .then(async (r) => {
        const data = { inventoryItem: await inventoryItemJson(r) };
        inventoryDetailMoney(data.inventoryItem);
        if (!controller.signal.aborted) {
          setItemRaw(data.inventoryItem);
          setEntityTitle(data.inventoryItem.name);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setReadError(t("readFailed"));
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [id, orgId, t]);

  useEffect(() => fetchItem(), [fetchItem]);

  const setItem = (fn: (prev: InventoryItemDetail) => InventoryItemDetail) => {
    setItemRaw((prev) => prev ? fn(prev) : prev);
  };

  function adoptItem(value: InventoryItemDetail) {
    try { inventoryItemRow(value); }
    catch (error) {
      readController.current?.abort();
      setLoading(false);
      setReadError(t("savedUnverified"));
      throw error;
    }
    readController.current?.abort();
    setItemRaw(value);
    setLoading(false);
  }

  async function handleAdjust() {
    if (!orgId) return;
    let adj: number | undefined;
    try { adj = catalogWholeInput(adjustment, true); }
    catch { toast.error(t("signedAdjustment")); return; }
    if (!adj || !adjustReason.trim()) {
      toast.error(t("adjustRequired"));
      return;
    }

    try {
      const res = await fetch(`/api/v1/inventory/${id}/adjust`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-organization-id": orgId },
        body: JSON.stringify({ adjustment: adj, reason: adjustReason }),
      });

      adoptItem(await inventoryItemJson(res));
      setAdjustOpen(false);
      setAdjustment("");
      setAdjustReason("");
      toast.success(t("countChanged", { adjustment: `${adj > 0 ? "+" : ""}${adj}` }));
    } catch {
      toast.error(t("adjustFailed"));
    }
  }

  async function handleWriteDown() {
    if (!orgId || !item || writeDownBusy || localStorage.getItem("activeOrgId") !== orgId) return;
    if (!writeDownReason.trim()) { toast.error(t("writeDownReasonRequired")); return; }
    let preview: ReturnType<typeof inventoryWriteDown>;
    try { preview = inventoryWriteDown(writeDownAmount, inventoryDetailMoney(item).carrying); }
    catch (error) { toast.error(t(inventoryWriteDownError(error))); return; }
    try {
      setWriteDownBusy(true);
      const res = await fetch(`/api/v1/inventory/${id}/adjust`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-organization-id": orgId },
        body: JSON.stringify({
          adjustmentType: "write_down",
          valueDeltaMinor: preview.valueDeltaMinor,
          reason: writeDownReason.trim(),
        }),
      });
      adoptItem(await inventoryItemJson(res));
      setWriteDownOpen(false);
      setWriteDownAmount("");
      setWriteDownReason("");
      toast.success(t("writtenDown"));
    } catch {
      toast.error(t("writeDownFailed"));
    } finally {
      setWriteDownBusy(false);
    }
  }

  async function handleToggleActive() {
    if (!orgId || !item) return;
    try {
      const res = await fetch(`/api/v1/inventory/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-organization-id": orgId },
        body: JSON.stringify({ isActive: !item.isActive }),
      });
      const updated = await inventoryItemJson(res);
      adoptItem(updated);
      toast.success(updated.isActive ? t("shownSuccess") : t("hiddenSuccess"));
    } catch {
      toast.error(t("toggleFailed"));
    }
  }

  if (loading) return <BrandLoader />;

  let detail: ReturnType<typeof inventoryDetailMoney> | null = null;
  let moneyError = readError;
  if (item) {
    try { detail = inventoryDetailMoney(item); }
    catch { moneyError = t("readFailed"); }
  }
  if (moneyError) return <div className="space-y-3 p-4"><p role="alert">{moneyError}</p><Button onClick={fetchItem}>{t("reloadItem")}</Button></div>;

  if (!item || !detail) {
    return (
      <div className="space-y-4 pt-12 text-center">
        <p className="text-sm text-muted-foreground">{t("notFound")}</p>
        <Button variant="outline" size="sm" onClick={() => router.push("/inventory")}>
          {t("backToInventory")}</Button>
      </div>
    );
  }

  const isLowStock = item.quantityOnHand <= item.reorderPoint && item.isActive;
  let writeDownPreview: ReturnType<typeof inventoryWriteDown> | null = null;
  let writeDownError = "";
  if (writeDownAmount) {
    try { writeDownPreview = inventoryWriteDown(writeDownAmount, detail.carrying); }
    catch (error) { writeDownError = t(inventoryWriteDownError(error)); }
  }
  const stockPercent = item.reorderPoint > 0
    ? Math.min((item.quantityOnHand / (item.reorderPoint * 3)) * 100, 100)
    : 100;

  // Determine active tab from pathname
  const activeTab = pathname.endsWith("/history")
    ? "history"
    : pathname.endsWith("/suppliers")
      ? "suppliers"
      : pathname.endsWith("/variants")
        ? "variants"
        : "details";

  return (
    <InventoryItemContext.Provider value={{ item, setItem, refetch: fetchItem }}>
      <ContentReveal>
        {/* Back link */}
        <button
          onClick={() => router.push("/inventory")}
          className="flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="size-3.5" />
          {t("backInventory")}</button>

        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className={cn(
              "flex size-10 items-center justify-center rounded-xl",
              isLowStock
                ? "bg-amber-50 dark:bg-amber-950/40"
                : "bg-emerald-50 dark:bg-emerald-950/40"
            )}>
              <Package className={cn(
                "size-5",
                isLowStock
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-emerald-600 dark:text-emerald-400"
              )} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-semibold">{item.name}</h1>
                {isLowStock && (
                  <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300" title={t("lowStockHelp")}>
                    {t("runningLow")}</Badge>
                )}
                <Badge variant="outline" className={
                  item.isActive
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                    : ""
                }>
                  {item.isActive ? t("shown") : t("hidden")}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {item.code}{item.sku ? ` · ${item.sku}` : ""}{item.category ? ` · ${item.category}` : ""}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleToggleActive}
              title={item.isActive ? t("hideItemHelp") : t("showItemHelp")}
            >
              {item.isActive ? (
                <><PowerOff className="mr-1.5 size-3.5" />{t("hideItem")}</>
              ) : (
                <><Power className="mr-1.5 size-3.5" />{t("showItem")}</>
              )}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setWriteDownOpen(true)}
              title={t("writeDownHelp")}
            >
              <TrendingDown className="mr-1.5 size-3.5" />
              {t("writeDown")}</Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setAdjustOpen(true)}
              title={t("adjustHelp")}
            >
              <ArrowUpDown className="mr-1.5 size-3.5" />
              {t("changeCount")}</Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          <motion.div
            className="rounded-xl border bg-card p-4"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1], delay: 0.05 }}
          >
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{t("unitsOnHand")}</p>
            <p className={cn(
              "mt-1.5 text-2xl font-bold font-mono tabular-nums break-words",
              isLowStock && "text-amber-600 dark:text-amber-400"
            )}>
              {item.quantityOnHand}
            </p>
            <div className="mt-2 flex items-center gap-2">
              <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
                <motion.div
                  className={cn(
                    "h-full rounded-full",
                    isLowStock ? "bg-amber-500" : "bg-emerald-500"
                  )}
                  initial={{ width: 0 }}
                  animate={{ width: `${stockPercent}%` }}
                  transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
                />
              </div>
              <span className="text-[10px] text-muted-foreground tabular-nums">
                {t("reorderAt", { count: item.reorderPoint })}
              </span>
            </div>
          </motion.div>
          <motion.div
            className="rounded-xl border bg-card p-4"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
          >
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{t("valueOfStock")}</p>
            <p className="mt-1.5 text-2xl font-bold font-mono tabular-nums break-words">
              {formatMoney(detail.priceValue)}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {t("stockCost", { count: item.quantityOnHand, amount: formatMoney(detail.purchase) })}
            </p>
          </motion.div>
          <motion.div
            className="rounded-xl border bg-card p-4"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
          >
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{t("sellingPrice")}</p>
            <p className="mt-1.5 text-2xl font-bold font-mono tabular-nums break-words text-emerald-600 dark:text-emerald-400">
              {formatMoney(detail.sale)}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {t("costAmount", { amount: formatMoney(detail.purchase) })}
            </p>
          </motion.div>
          <motion.div
            className="rounded-xl border bg-card p-4"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
          >
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{t("profitMargin")}</p>
            <p className={cn(
              "mt-1.5 text-2xl font-bold font-mono tabular-nums break-words",
              detail.profit > 0n ? "text-emerald-600 dark:text-emerald-400" : detail.profit < 0n ? "text-red-600" : ""
            )}>
              {detail.margin}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {detail.purchase > 0n ? t("profitPerUnit", { amount: formatMoney(detail.profit) }) : t("noCost")}
            </p>
          </motion.div>
        </div>

        {/* Page tabs */}
        <nav className="-mt-2 mb-8 flex items-center gap-1 overflow-x-auto border-b border-border">
          {PAGE_TABS.map((tab) => {
            const Icon = tab.icon;
            const tabHref = tab.href(id);
            return (
              <button
                key={tab.value}
                onClick={() => router.push(tabHref)}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 border-b-2 px-2.5 pb-2.5 text-[13px] font-medium transition-colors",
                  activeTab === tab.value
                    ? "border-foreground text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="size-3.5" />
                {t(tab.label)}
              </button>
            );
          })}
        </nav>

        {/* Tab content */}
        <ContentReveal key={pathname}>
          {children}
        </ContentReveal>

        {/* Change the count sheet */}
        <Sheet open={adjustOpen} onOpenChange={setAdjustOpen}>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>{t("changeCount")}</SheetTitle>
              <SheetDescription>
                {t("adjustSheetHelp")}</SheetDescription>
            </SheetHeader>
            <div className="space-y-4 px-4">
              <div className="rounded-lg bg-muted p-3">
                <p className="text-xs text-muted-foreground">{t("unitsNow")}</p>
                <p className="text-xl font-bold font-mono tabular-nums break-words">{item.quantityOnHand}</p>
              </div>
              <div className="space-y-2">
                <Label>{t("addRemove")}</Label>
                <Input
                  type="number"
                  value={adjustment}
                  onChange={(e) => setAdjustment(e.target.value)}
                  placeholder={t("adjustExample")}
                />
                {adjustment && parseInt(adjustment) !== 0 && (
                  <p className="text-xs text-muted-foreground">
                    {t("newCount")} <span className="font-mono font-medium">{item.quantityOnHand + parseInt(adjustment)}</span>
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>{t("reasonRequired")}</Label>
                <Input
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder={t("reasonExample")}
                />
              </div>
            </div>
            <SheetFooter>
              <Button variant="outline" onClick={() => setAdjustOpen(false)}>{t("cancel")}</Button>
              <Button onClick={handleAdjust} className="bg-emerald-600 hover:bg-emerald-700">
                {t("saveCount")}</Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>

        {/* Write down value sheet */}
        <Sheet open={writeDownOpen} onOpenChange={(open) => {
          if (writeDownBusy) return;
          setWriteDownOpen(open);
          if (!open) { setWriteDownAmount(""); setWriteDownReason(""); }
        }}>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>{t("writeDown")}</SheetTitle>
              <SheetDescription>
                {t("writeDownSheetHelp")}</SheetDescription>
            </SheetHeader>
            <div className="space-y-4 px-4">
              <div className="rounded-lg bg-muted p-3">
                <p className="text-xs text-muted-foreground">{t("currentBookValue")}</p>
                <p className="text-xl font-bold font-mono tabular-nums break-words">
                  {formatMoney(detail.carrying)}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="inventory-write-off">{t("writeDownAmount")}</Label>
                <Input
                  id="inventory-write-off" inputMode="decimal" value={writeDownAmount}
                  onChange={(event) => setWriteDownAmount(event.target.value)}
                  aria-invalid={!!writeDownError} aria-describedby="inventory-write-off-feedback"
                  disabled={writeDownBusy} placeholder="0.00"
                />
                <p className="text-xs text-muted-foreground">{t("amountHelp")}</p>
                <div id="inventory-write-off-feedback">
                  {writeDownError && <p role="alert" className="text-sm text-destructive">{writeDownError}</p>}
                  {writeDownPreview && <p className="text-sm break-words">{t("writeDownPreview", { amount: formatMoney(writeDownPreview.amount), remaining: formatMoney(writeDownPreview.remaining) })}</p>}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="inventory-write-off-reason">{t("reasonRequired")}</Label>
                <Input
                  id="inventory-write-off-reason" disabled={writeDownBusy}
                  value={writeDownReason}
                  onChange={(e) => setWriteDownReason(e.target.value)}
                  placeholder={t("writeDownExample")}
                />
              </div>
            </div>
            <SheetFooter>
              <Button variant="outline" disabled={writeDownBusy} onClick={() => { setWriteDownOpen(false); setWriteDownAmount(""); setWriteDownReason(""); }}>{t("cancel")}</Button>
              <Button onClick={handleWriteDown} disabled={writeDownBusy || !writeDownPreview || !writeDownReason.trim()} className="bg-emerald-600 hover:bg-emerald-700">
                {t("writeDown")}</Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </ContentReveal>
    </InventoryItemContext.Provider>
  );
}
