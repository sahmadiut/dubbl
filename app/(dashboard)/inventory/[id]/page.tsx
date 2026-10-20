"use client";

import { inventoryItemJson, inventoryDeleteJson, inventoryWarehouseJson, inventoryPrintEscape } from "@/i18n/inventory-item-presentation";
import { useTranslations } from "next-intl";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2, Save, Loader2, Warehouse, Printer, Scale } from "lucide-react";
import { Section } from "@/components/dashboard/section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { inventoryUiItem } from "@/lib/money/inventory-ui";
import { inventoryDetailMoney } from "@/lib/money/inventory-detail-ui";
import { catalogPriceMinor, catalogWholeInput } from "@/lib/money/catalog-input";
import { toMajorDecimal } from "@/lib/money/exact";
import { bankMoneyDisplay } from "@/lib/money/bank-display";
const formatMoney = (value: number | bigint) => bankMoneyDisplay(value, "USD");
import { useConfirm } from "@/lib/hooks/use-confirm";
import { useDocumentTitle } from "@/lib/hooks/use-document-title";
import { setEntityTitle } from "@/lib/hooks/use-entity-title";
import { CategoryPicker } from "@/components/dashboard/category-picker";
import { useInventoryItem } from "./layout";
import JsBarcode from "jsbarcode";

interface WarehouseStockEntry {
  id: string;
  warehouseId: string;
  warehouseName: string;
  warehouseCode: string;
  quantity: number;
  updatedAt: string;
}

export default function InventoryItemDetailsPage() {
  const t = useTranslations("InventoryItems");
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { item, setItem } = useInventoryItem();
  const [saving, setSaving] = useState(false);
  const [categoryId, setCategoryId] = useState(item.categoryId || "");
  const [invPurchasePrice, setInvPurchasePrice] = useState(toMajorDecimal({ amountMinor: BigInt(item.purchasePriceMinor), currency: "USD" }));
  const [invSalePrice, setInvSalePrice] = useState(toMajorDecimal({ amountMinor: BigInt(item.salePriceMinor), currency: "USD" }));
  const [warehouseStocks, setWarehouseStocks] = useState<WarehouseStockEntry[]>([]);
  // "Revalue stock" sheet: set the book value directly (mark-to-market) without
  // changing the count.
  const [revalueOpen, setRevalueOpen] = useState(false);
  const [revalueValue, setRevalueValue] = useState("");
  const [revalueReason, setRevalueReason] = useState("");
  const [revalueBusy, setRevalueBusy] = useState(false);
  const { confirm, dialog: confirmDialog } = useConfirm();
  useDocumentTitle(t("detailsTitle"));

  const orgId = typeof window !== "undefined" ? localStorage.getItem("activeOrgId") : null;

  // Fetch per-warehouse stock
  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;
    fetch(`/api/v1/inventory/${id}/warehouse-stock`, {
      headers: { "x-organization-id": orgId },
    })
      .then(inventoryWarehouseJson)
      .then((data) => { if (!cancelled) setWarehouseStocks(data); })
      .catch(() => { if (!cancelled) toast.error(t("historyReadFailed")); });
    return () => { cancelled = true; };
  }, [id, orgId, t]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!orgId) return;
    setSaving(true);
    const form = new FormData(e.currentTarget);

    try {
      const res = await fetch(`/api/v1/inventory/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-organization-id": orgId,
        },
        body: JSON.stringify({
          code: form.get("code"),
          name: form.get("name"),
          description: form.get("description") || null,
          categoryId: categoryId || null,
          sku: form.get("sku") || null,
          purchasePriceMinor: catalogPriceMinor(invPurchasePrice || "0"),
          salePriceMinor: catalogPriceMinor(invSalePrice || "0"),
          reorderPoint: catalogWholeInput(form.get("reorderPoint") as string || "0"),
        }),
      });

      const updated = inventoryUiItem(await inventoryItemJson(res));
      setItem(() => updated);
      setEntityTitle(updated.name);
      toast.success(t("updated"));
    } catch {
      toast.error(t("updateFailed"));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    const confirmed = await confirm({
      title: t("deleteItemTitle"),
      description: t("irreversible"),
      confirmLabel: t("delete"),
      destructive: true,
    });
    if (!confirmed) return;
    if (!orgId) return;

    try {
      await inventoryDeleteJson(await fetch(`/api/v1/inventory/${id}`, {
        method: "DELETE", headers: { "x-organization-id": orgId },
      }));
      toast.success(t("deleted"));
      router.push("/inventory");
    } catch { toast.error(t("deleteFailed")); }
  }

  const currentBookValue = inventoryDetailMoney(item).carrying;

  function openRevalue() {
    // Pre-fill with the current value so the user adjusts from a known starting point.
    setRevalueValue(toMajorDecimal({ amountMinor: BigInt(currentBookValue), currency: "USD" }));
    setRevalueReason("");
    setRevalueOpen(true);
  }

  async function handleRevalue() {
    if (!orgId) return;
    let newTotalValueMinor: string | undefined;
    try { newTotalValueMinor = catalogPriceMinor(revalueValue); } catch { toast.error(t("exactValue")); return; }
    if (newTotalValueMinor === undefined || !revalueReason.trim()) {
      toast.error(t("revalueRequired"));
      return;
    }
    if (BigInt(newTotalValueMinor) === BigInt(currentBookValue)) {
      toast.error(t("sameValue"));
      return;
    }

    const confirmed = await confirm({
      title: t("revalueTitle"),
      description: t("revalueConfirm", { from: formatMoney(currentBookValue), to: formatMoney(BigInt(newTotalValueMinor)) }),
      confirmLabel: t("revalue"),
    });
    if (!confirmed) return;

    setRevalueBusy(true);
    try {
      const res = await fetch(`/api/v1/inventory/${id}/adjust`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-organization-id": orgId },
        body: JSON.stringify({
          adjustmentType: "revaluation",
          newTotalValueMinor,
          reason: revalueReason,
        }),
      });
      const updated = inventoryUiItem(await inventoryItemJson(res));
      setItem(() => updated);
      setRevalueOpen(false);
      setRevalueValue("");
      setRevalueReason("");
      toast.success(t("revalued"));
    } catch {
      toast.error(t("revalueFailed"));
    } finally {
      setRevalueBusy(false);
    }
  }

  function printBarcode() {
    const barcodeValue = item.sku || item.code;
    const canvas = document.createElement("canvas");
    try {
      JsBarcode(canvas, barcodeValue, {
        format: "CODE128",
        width: 2,
        height: 80,
        displayValue: true,
        fontSize: 14,
        margin: 10,
      });
    } catch {
      toast.error(t("barcodeFailed"));
      return;
    }

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head><title>${inventoryPrintEscape(t("barcodeTitle", { name: item.name }))}</title></head>
        <body style="display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;flex-direction:column;gap:8px">
          <h3 style="margin:0;font-family:sans-serif">${inventoryPrintEscape(item.name)}</h3>
          <img src="${canvas.toDataURL()}" alt="${inventoryPrintEscape(t("barcode"))}" />
          <script>window.print();window.close();</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  }

  // Generate barcode preview
  const barcodeValue = item.sku || item.code;
  const barcodeRef = (canvas: HTMLCanvasElement | null) => {
    if (!canvas) return;
    try {
      JsBarcode(canvas, barcodeValue, {
        format: "CODE128",
        width: 1.5,
        height: 50,
        displayValue: true,
        fontSize: 11,
        margin: 5,
      });
    } catch {
      // Invalid barcode value
    }
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-10">
        <Section title={t("general")} description={t("generalDescription")}>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs" htmlFor="code">{t("code")}</Label>
                <Input id="code" name="code" required defaultValue={item.code} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs" htmlFor="name">{t("name")}</Label>
                <Input id="name" name="name" required defaultValue={item.name} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t("category")}</Label>
                <CategoryPicker value={categoryId} onChange={setCategoryId} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs" htmlFor="sku">{t("sku")}</Label>
                <Input id="sku" name="sku" defaultValue={item.sku || ""} placeholder={t("optional")} />
              </div>
            </div>
          </div>
        </Section>

        <div className="h-px bg-border" />

        <Section title={t("pricing")} description={t("pricingDescription")}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs" htmlFor="purchasePrice">{t("purchaseCost")}</Label>
              <CurrencyInput
                id="purchasePrice"
                prefix="$"
                value={invPurchasePrice}
                onChange={setInvPurchasePrice}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs" htmlFor="salePrice">{t("sellingFor")}</Label>
              <CurrencyInput
                id="salePrice"
                prefix="$"
                value={invSalePrice}
                onChange={setInvSalePrice}
              />
            </div>
          </div>
        </Section>

        <div className="h-px bg-border" />

        <Section title={t("stock")} description={t("stockDescription")}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs" htmlFor="reorderPoint">{t("alertThreshold")}</Label>
              <Input
                id="reorderPoint"
                name="reorderPoint"
                type="number"
                min={0}
                defaultValue={item.reorderPoint}
              />
            </div>
          </div>
        </Section>

        <div className="h-px bg-border" />

        <Section title={t("description")} description={t("descriptionHelp")}>
          <Textarea
            id="description"
            name="description"
            defaultValue={item.description || ""}
            rows={3}
            placeholder={t("itemDescription")}
          />
        </Section>

        <div className="flex justify-end">
          <Button
            type="submit"
            size="sm"
            disabled={saving}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {saving ? (
              <>
                <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                {t("saving")}</>
            ) : (
              <>
                <Save className="mr-1.5 size-3.5" />
                {t("saveChanges")}</>
            )}
          </Button>
        </div>
      </form>

      {/* Per-warehouse stock */}
      {warehouseStocks.length > 0 && (
        <>
          <div className="h-px bg-border mt-10" />
          <div className="mt-10">
          <Section title={t("stockByLocation")} description={t("stockByLocationHelp")}>
            <div className="rounded-lg border divide-y">
              {warehouseStocks.map((ws) => (
                <div key={ws.id} className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Warehouse className="size-3.5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{ws.warehouseName}</p>
                      <p className="text-xs text-muted-foreground">{ws.warehouseCode}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-mono tabular-nums font-medium">{ws.quantity}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {new Date(ws.updatedAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Section>
          </div>
        </>
      )}

      {/* Barcode */}
      <div className="h-px bg-border mt-10" />
      <div className="mt-10">
        <Section title={t("barcode")} description={t("barcodeHelp")}>
          <div className="flex flex-col items-start gap-3">
            <div className="rounded-lg border bg-white p-3">
              <canvas ref={barcodeRef} />
            </div>
            <Button type="button" size="sm" variant="outline" onClick={printBarcode}>
              <Printer className="mr-1.5 size-3.5" />
              {t("printBarcode")}</Button>
          </div>
        </Section>
      </div>

      {/* Revalue stock */}
      <div className="h-px bg-border mt-10" />
      <div className="mt-10">
        <Section
          title={t("revalueStock")}
          description={t("revalueHelp")}
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-md border px-4 py-3">
            <div>
              <p className="text-xs text-muted-foreground">{t("currentBookValue")}</p>
              <p className="text-lg font-bold font-mono tabular-nums truncate">
                {formatMoney(currentBookValue)}
              </p>
            </div>
            <Button type="button" size="sm" variant="outline" onClick={openRevalue}>
              <Scale className="mr-1.5 size-3.5" />
              {t("revalueStock")}</Button>
          </div>
        </Section>
      </div>

      <div className="h-px bg-border mt-10" />
      <div className="mt-10">
        <Section title={t("dangerZone")} description={t("dangerHelp")}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-md border border-red-200 bg-red-50 px-4 py-3 dark:border-red-900/50 dark:bg-red-950/20">
          <div>
            <p className="text-sm font-medium text-red-700 dark:text-red-400">{t("deleteThisItem")}</p>
            <p className="text-xs text-red-600/70 dark:text-red-400/70">{t("deleteHelp")}</p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleDelete}
            className="border-red-300 text-red-600 hover:bg-red-100 hover:text-red-700 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/40"
          >
            <Trash2 className="mr-1.5 size-3.5" />
            {t("deleteItem")}</Button>
        </div>
      </Section>
      </div>

      {/* Revalue stock sheet */}
      <Sheet open={revalueOpen} onOpenChange={setRevalueOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{t("revalueStock")}</SheetTitle>
            <SheetDescription>
              {t("revalueSheetHelp")}</SheetDescription>
          </SheetHeader>
          <div className="space-y-4 px-4">
            <div className="rounded-lg bg-muted p-3">
              <p className="text-xs text-muted-foreground">{t("currentBookValue")}</p>
              <p className="text-xl font-bold font-mono tabular-nums truncate">
                {formatMoney(currentBookValue)}
              </p>
            </div>
            <div className="space-y-2">
              <Label>{t("newValue")}</Label>
              <CurrencyInput
                prefix="$"
                value={revalueValue}
                onChange={setRevalueValue}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("reasonRequired")}</Label>
              <Input
                value={revalueReason}
                onChange={(e) => setRevalueReason(e.target.value)}
                placeholder={t("revalueExample")}
              />
            </div>
          </div>
          <SheetFooter>
            <Button variant="outline" onClick={() => setRevalueOpen(false)}>{t("cancel")}</Button>
            <Button onClick={handleRevalue} disabled={revalueBusy} className="bg-emerald-600 hover:bg-emerald-700">
              {t("revalueStock")}</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {confirmDialog}
    </>
  );
}
