"use client";

import { BidiText } from "@/components/ui/bidi-text";
import { usePresentation as useUnitPresentation } from "@/i18n/provider";
import { currencyLabel } from "@/i18n/currency-labels";

import { inventorySuppliersJson, inventoryCatalogJson, inventoryCatalogInputError, inventorySupplierRow, type PresentedInventorySupplier } from "@/i18n/inventory-catalog-presentation";
import { useTranslations } from "next-intl";
import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { Truck, Link2, Unlink } from "lucide-react";
import { BrandLoader } from "@/components/dashboard/brand-loader";
import { EmptyState } from "@/components/dashboard/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ContactPicker } from "@/components/dashboard/contact-picker";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { bankMoneyDisplay as exactPriceDisplay } from "@/lib/money/bank-display";
import { catalogPriceMinor, catalogWholeInput } from "@/lib/money/catalog-input";
import { useConfirm } from "@/lib/hooks/use-confirm";
import { useDocumentTitle } from "@/lib/hooks/use-document-title";

export default function InventoryItemSuppliersPage() {
  const unitPresentation = useUnitPresentation();
  const t = useTranslations("InventoryCatalogs");
  const { id } = useParams<{ id: string }>();
  const [suppliers, setSuppliers] = useState<PresentedInventorySupplier[]>([]);
  const [readError, setReadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const { confirm, dialog: confirmDialog } = useConfirm();

  const [linkOpen, setLinkOpen] = useState(false);
  const [contactId, setContactId] = useState("");
  const [supplierCode, setSupplierCode] = useState("");
  const [leadDays, setLeadDays] = useState("");
  const [price, setPrice] = useState("");
  const [preferred, setPreferred] = useState(false);
  useDocumentTitle(t("suppliersTitle"));

  const fetchSuppliers = useCallback(async (isCancelled: () => boolean = () => false) => {
    const orgId = localStorage.getItem("activeOrgId");
    try {
      if (!orgId) throw new Error("Organization required");
      const rows = await inventorySuppliersJson(await fetch(`/api/v1/inventory/${id}/suppliers`, {
        headers: { "x-organization-id": orgId },
      }));
      if (!isCancelled()) { setSuppliers(rows); setReadError(false); }
      return true;
    } catch { if (!isCancelled()) setReadError(true); return false; }
    finally { if (!isCancelled()) setLoading(false); }
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    async function readSuppliers() {
      setLoading(true);
      await fetchSuppliers(() => cancelled);
    }
    void readSuppliers();
    return () => { cancelled = true; };
  }, [fetchSuppliers]);

  async function handleLink() {
    const orgId = localStorage.getItem("activeOrgId");
    if (!orgId || !contactId.trim()) {
      toast.error(t(!orgId ? "organizationRequired" : "contactRequired"));
      return;
    }

    let payload;
    try {
      payload = {
        contactId: contactId.trim(),
        supplierCode: supplierCode || undefined,
        leadTimeDays: catalogWholeInput(leadDays),
        purchasePriceMinor: catalogPriceMinor(price),
        isPreferred: preferred,
      };
    } catch (error) { toast.error(t(inventoryCatalogInputError(error))); return; }

    setSaving(true);
    try {
      const data = await inventoryCatalogJson(await fetch(`/api/v1/inventory/${id}/suppliers`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-organization-id": orgId },
        body: JSON.stringify(payload),
      }));
      inventorySupplierRow(data.inventoryItemSupplier);
      setLinkOpen(false);
      setContactId("");
      setSupplierCode("");
      setLeadDays("");
      setPrice("");
      setPreferred(false);
      if (await fetchSuppliers()) toast.success(t("supplierLinked"));
      else toast.error(t("linkedRefreshFailed"));
    } catch {
      toast.error(t("supplierLinkFailed"));
    } finally { setSaving(false); }
  }

  async function handleUnlink(supplierId: string) {
    const confirmed = await confirm({
      title: t("unlinkTitle"),
      description: t("unlinkDescription"),
      confirmLabel: t("unlink"),
      cancelLabel: t("cancel"),
      destructive: true,
    });
    if (!confirmed) return;

    const orgId = localStorage.getItem("activeOrgId");
    if (!orgId) { toast.error(t("organizationRequired")); return; }

    try {
      const data = await inventoryCatalogJson(await fetch(`/api/v1/inventory/${id}/suppliers/${supplierId}`, {
        method: "DELETE",
        headers: { "x-organization-id": orgId },
      }));
      if (data.success !== true) throw new Error("Invalid unlink response");
      setSuppliers((prev) => prev.filter((s) => s.id !== supplierId));
      toast.success(t("supplierUnlinked"));
    } catch {
      toast.error(t("supplierUnlinkFailed"));
    }
  }

  if (loading) return <BrandLoader />;
  if (readError) return <p role="alert">{t("readFailed")}</p>;

  return (
    <>
      <div className="flex items-center justify-between mb-4 flex-wrap">
        <h3 className="text-sm font-semibold">{t("suppliers")}</h3>
        <Button size="sm" variant="outline" onClick={() => setLinkOpen(true)} className="h-auto min-h-8 max-w-full whitespace-normal py-1.5 [overflow-wrap:anywhere]" >
          <Link2 className="me-1.5 size-3.5" />
          {t("linkSupplier")}
        </Button>
      </div>

      {suppliers.length === 0 ? (
        <EmptyState
          icon={Truck}
          title={t("emptySuppliers")}
          description={t("emptySuppliersHelp")}
          compact
        >
          <Button size="sm" onClick={() => setLinkOpen(true)} className="bg-emerald-600 hover:bg-emerald-700 h-auto min-h-8 max-w-full whitespace-normal py-1.5 [overflow-wrap:anywhere]">
            <Link2 className="me-1.5 size-3.5" />
            {t("linkSupplier")}
          </Button>
        </EmptyState>
      ) : (
        <div className="rounded-xl border bg-card divide-y">
          {suppliers.map((s) => (
            <div key={s.id} className="flex items-center gap-4 p-4 flex-wrap">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium whitespace-normal [overflow-wrap:anywhere]"><BidiText>{s.contactName || s.contact?.name || s.contactId}</BidiText></p>
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  {s.supplierCode && (
                    <span className="text-xs text-muted-foreground"><BidiText>{t("codeValue", { value: s.supplierCode })}</BidiText></span>
                  )}
                  {s.leadTimeDays != null && (
                    <span className="text-xs text-muted-foreground"><BidiText>{t("leadValue", { value: String(s.leadTimeDays) })}</BidiText></span>
                  )}
                  {s.purchasePrice != null && (
                    <span className="text-xs text-muted-foreground"><BidiText>{t("priceValue", { value: exactPriceDisplay(s.purchasePrice, "USD", unitPresentation) })}</BidiText></span>
                  )}
                  {s.isPreferred && (
                    <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 text-[10px]">
                      {t("preferred")}
                    </Badge>
                  )}
                </div>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30 h-auto min-h-8 max-w-full whitespace-normal py-1.5 [overflow-wrap:anywhere]"
                aria-label={t("unlink")}
                onClick={() => handleUnlink(s.id)}
              >
                <Unlink className="size-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <Sheet open={linkOpen} onOpenChange={setLinkOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{t("linkSupplier")}</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 px-4">
            <div className="space-y-1.5">
              <Label className="text-xs">{t("supplierRequired")}</Label>
              <ContactPicker
                value={contactId}
                onChange={setContactId}
                type="supplier"
                placeholder={t("selectSupplier")}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs" htmlFor="inventory-field-1">{t("supplierCode")}</Label>
              <Input
                value={supplierCode}
                onChange={(e) => setSupplierCode(e.target.value)}
                placeholder={t("optionalSupplierCode")}
               dir="ltr" aria-label={t("supplierCode")} id="inventory-field-1" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs" htmlFor="inventory-field-2">{t("leadTimeDays")}</Label>
              <Input
                type="number"
                min={0}
                value={leadDays}
                onChange={(e) => setLeadDays(e.target.value)}
                placeholder={t("leadExample")}
               dir="ltr" aria-label={t("leadTimeDays")} id="inventory-field-2" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs" htmlFor="inventory-field-3">{t("purchasePrice")}</Label>
              <CurrencyInput
                prefix={currencyLabel("USD", unitPresentation.locale, "$")}
                value={price}
                onChange={setPrice}
               aria-label={t("purchasePrice")} id="inventory-field-3" />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Checkbox
                id="supplierPreferred"
                checked={preferred}
                onCheckedChange={(checked) => setPreferred(checked === true)}
              />
              <Label htmlFor="supplierPreferred" className="text-xs cursor-pointer">{t("preferredSupplier")}</Label>
            </div>
          </div>
          <SheetFooter>
            <Button variant="outline" onClick={() => setLinkOpen(false)} className="h-auto min-h-8 max-w-full whitespace-normal py-1.5 [overflow-wrap:anywhere]" >{t("cancel")}</Button>
            <Button onClick={handleLink} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 h-auto min-h-8 max-w-full whitespace-normal py-1.5 [overflow-wrap:anywhere]">
              {t("linkSupplier")}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
      {confirmDialog}
    </>
  );
}
