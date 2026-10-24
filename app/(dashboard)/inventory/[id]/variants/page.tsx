"use client";

import { BidiText } from "@/components/ui/bidi-text";
import { usePresentation as useUnitPresentation } from "@/i18n/provider";
import { currencyLabel } from "@/i18n/currency-labels";

import { inventoryVariantsJson, inventoryCatalogJson, inventoryCatalogInputError, inventoryVariantRow, type PresentedInventoryVariant } from "@/i18n/inventory-catalog-presentation";
import { useTranslations } from "next-intl";
import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { Layers, Plus } from "lucide-react";
import { BrandLoader } from "@/components/dashboard/brand-loader";
import { EmptyState } from "@/components/dashboard/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { bankMoneyDisplay as exactPriceDisplay } from "@/lib/money/bank-display";
import { catalogPriceMinor, catalogWholeInput } from "@/lib/money/catalog-input";
import { useDocumentTitle } from "@/lib/hooks/use-document-title";
import { cn } from "@/lib/utils";

export default function InventoryItemVariantsPage() {
  const unitPresentation = useUnitPresentation();
  const t = useTranslations("InventoryCatalogs");
  const { id } = useParams<{ id: string }>();
  const [variants, setVariants] = useState<PresentedInventoryVariant[]>([]);
  const [readError, setReadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [quantity, setQuantity] = useState("");
  useDocumentTitle(t("variantsTitle"));

  useEffect(() => {
    const orgId = localStorage.getItem("activeOrgId");
    let cancelled = false;
    async function readVariants() {
      setLoading(true);
      setReadError(false);
      try {
        if (!orgId) throw new Error("Organization required");
        const rows = await inventoryVariantsJson(await fetch(`/api/v1/inventory/${id}/variants`, {
          headers: { "x-organization-id": orgId },
        }));
        if (!cancelled) setVariants(rows);
      } catch { if (!cancelled) setReadError(true); }
      finally { if (!cancelled) setLoading(false); }
    }
    void readVariants();
    return () => { cancelled = true; };
  }, [id]);

  async function handleAdd() {
    const orgId = localStorage.getItem("activeOrgId");
    if (!orgId || !name.trim()) {
      toast.error(t(!orgId ? "organizationRequired" : "variantNameRequired"));
      return;
    }

    let payload;
    try {
      payload = {
        name: name.trim(),
        sku: sku || undefined,
        purchasePriceMinor: catalogPriceMinor(purchasePrice),
        salePriceMinor: catalogPriceMinor(salePrice),
        quantityOnHand: catalogWholeInput(quantity, true),
      };
    } catch (error) { toast.error(t(inventoryCatalogInputError(error))); return; }

    setSaving(true);
    try {
      const data = await inventoryCatalogJson(await fetch(`/api/v1/inventory/${id}/variants`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-organization-id": orgId },
        body: JSON.stringify(payload),
      }));
      const variant = inventoryVariantRow(data.inventoryVariant);
      setVariants((prev) => [...prev, variant]);
      setAddOpen(false);
      setName("");
      setSku("");
      setPurchasePrice("");
      setSalePrice("");
      setQuantity("");
      toast.success(t("variantAdded"));
    } catch {
      toast.error(t("variantAddFailed"));
    } finally { setSaving(false); }
  }

  if (loading) return <BrandLoader />;
  if (readError) return <p role="alert">{t("readFailed")}</p>;

  return (
    <>
      <div className="flex items-center justify-between mb-4 flex-wrap">
        <h3 className="text-sm font-semibold">{t("variants")}</h3>
        <Button size="sm" variant="outline" onClick={() => setAddOpen(true)} className="h-auto min-h-8 max-w-full whitespace-normal py-1.5 [overflow-wrap:anywhere]" >
          <Plus className="me-1.5 size-3.5" />
          {t("addVariant")}
        </Button>
      </div>

      {variants.length === 0 ? (
        <EmptyState
          icon={Layers}
          title={t("emptyVariants")}
          description={t("emptyVariantsHelp")}
          compact
        >
          <Button size="sm" onClick={() => setAddOpen(true)} className="bg-emerald-600 hover:bg-emerald-700 h-auto min-h-8 max-w-full whitespace-normal py-1.5 [overflow-wrap:anywhere]">
            <Plus className="me-1.5 size-3.5" />
            {t("addVariant")}
          </Button>
        </EmptyState>
      ) : (
        <div className="rounded-xl border bg-card divide-y">
          {variants.map((v) => (
            <div key={v.id} className="flex items-center gap-4 p-4 flex-wrap">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium whitespace-normal [overflow-wrap:anywhere]"><BidiText>{v.name}</BidiText></p>
                  <Badge variant="outline" className={cn(
                    "text-[10px]",
                    v.isActive !== false
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                      : ""
                  )}>
                    {t(v.isActive !== false ? "active" : "inactive")}
                  </Badge>
                </div>
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  {v.sku && (
                    <span className="text-xs text-muted-foreground"><BidiText>{t("skuValue", { value: v.sku })}</BidiText></span>
                  )}
                  {v.purchasePrice != null && (
                    <span className="text-xs text-muted-foreground"><BidiText>{t("costValue", { value: exactPriceDisplay(v.purchasePrice, "USD", unitPresentation) })}</BidiText></span>
                  )}
                  {v.salePrice != null && (
                    <span className="text-xs text-muted-foreground"><BidiText>{t("saleValue", { value: exactPriceDisplay(v.salePrice, "USD", unitPresentation) })}</BidiText></span>
                  )}
                  {v.quantityOnHand != null && (
                    <span className="text-xs text-muted-foreground"><BidiText>{t("quantityValue", { value: String(v.quantityOnHand) })}</BidiText></span>
                  )}
                  {v.options && Object.entries(v.options).map(([key, val]) => (
                    <Badge key={key} variant="secondary" className="text-[10px]">
                      <BidiText>{key}</BidiText>: <BidiText>{String(val)}</BidiText>
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Sheet open={addOpen} onOpenChange={setAddOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{t("addVariant")}</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 px-4">
            <div className="space-y-1.5">
              <Label className="text-xs" htmlFor="inventory-field-1">{t("nameRequired")}</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("variantExample")}
               dir="auto" aria-label={t("nameRequired")} id="inventory-field-1" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs" htmlFor="inventory-field-2">{t("sku")}</Label>
              <Input
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                placeholder={t("optionalSku")}
               dir="ltr" aria-label={t("sku")} id="inventory-field-2" />
            </div>
            <div className="grid gap-4 grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs" htmlFor="inventory-field-3">{t("purchasePrice")}</Label>
                <CurrencyInput
                  prefix={currencyLabel("USD", unitPresentation.locale, "$")}
                  value={purchasePrice}
                  onChange={setPurchasePrice}
                 aria-label={t("purchasePrice")} id="inventory-field-3" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs" htmlFor="inventory-field-4">{t("salePrice")}</Label>
                <CurrencyInput
                  prefix={currencyLabel("USD", unitPresentation.locale, "$")}
                  value={salePrice}
                  onChange={setSalePrice}
                 aria-label={t("salePrice")} id="inventory-field-4" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs" htmlFor="inventory-field-5">{t("quantityOnHand")}</Label>
              <Input
                type="number"
                min={0}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="0"
               dir="ltr" aria-label={t("quantityOnHand")} id="inventory-field-5" />
            </div>
          </div>
          <SheetFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)} className="h-auto min-h-8 max-w-full whitespace-normal py-1.5 [overflow-wrap:anywhere]" >{t("cancel")}</Button>
            <Button onClick={handleAdd} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 h-auto min-h-8 max-w-full whitespace-normal py-1.5 [overflow-wrap:anywhere]">
              {t("addVariant")}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}
