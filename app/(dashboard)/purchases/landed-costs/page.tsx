"use client";

import { BidiText } from "@/components/ui/bidi-text";
import { localeDirection } from "@/i18n/locale";

import { usePresentation } from "@/i18n/provider";
import type { NumberPresentation } from "@/i18n/numbers";
import { currencyLabel } from "@/i18n/currency-labels";
import { useTranslations } from "next-intl";
import { landedCostStatusLabel, landedCostMethodLabel } from "@/i18n/landed-cost-presentation";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Plus, Trash2 } from "lucide-react";
import { useDocumentTitle } from "@/lib/hooks/use-document-title";
import { toast } from "sonner";
import { money, toMajorDecimal } from "@/lib/money/exact";
import { catalogPriceMinor } from "@/lib/money/catalog-input";

interface CostComponent {
  description: string;
  amount: string;
  accountId: string;
}

interface LandedCost {
  id: string;
  name: string;
  allocationMethod: string;
  totalCostAmount: number;
  currencyCode: string;
  status: string;
  createdAt: string;
  purchaseOrder?: { poNumber: string } | null;
  bill?: { billNumber: string } | null;
}

const formatMoney = (amount: number, currency: string, presentation: NumberPresentation) => `${currencyLabel(currency, presentation.locale)} ${toMajorDecimal(money(BigInt(amount), currency))}`;

export default function LandedCostsPage() {
  const unitPresentation = usePresentation();
  const router = useRouter();
  const t = useTranslations("LandedCosts");
  const [readError, setReadError] = useState(false);
  const [items, setItems] = useState<LandedCost[]>([]);
  const [loading, setLoading] = useState(true);

  useDocumentTitle(t("documentTitle"));
  const [sheetOpen, setSheetOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [purchaseOrderId, setPurchaseOrderId] = useState("");
  const [billId, setBillId] = useState("");
  const [allocationMethod, setAllocationMethod] = useState("by_value");
  const [components, setComponents] = useState<CostComponent[]>([
    { description: "", amount: "", accountId: "" },
  ]);

  const orgId =
    typeof window !== "undefined"
      ? localStorage.getItem("activeOrgId") || ""
      : "";

  const fetchItems = useCallback(() => {
    if (!orgId) { setLoading(false); return; }
    fetch("/api/v1/landed-costs", {
      headers: { "x-organization-id": orgId },
    })
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then((data) => {
        if (!data || !Array.isArray(data.data)) throw new Error();
        setItems(data.data);
        setReadError(false);
      })
      .catch(() => setReadError(true))
      .finally(() => setLoading(false));
  }, [orgId]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  function resetForm() {
    setName("");
    setPurchaseOrderId("");
    setBillId("");
    setAllocationMethod("by_value");
    setComponents([{ description: "", amount: "", accountId: "" }]);
  }

  function updateComponent(index: number, updates: Partial<CostComponent>) {
    setComponents((prev) =>
      prev.map((c, i) => (i === index ? { ...c, ...updates } : c))
    );
  }

  function addComponent() {
    setComponents((prev) => [
      ...prev,
      { description: "", amount: "", accountId: "" },
    ]);
  }

  function removeComponent(index: number) {
    if (components.length <= 1) return;
    setComponents((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    if (!name.trim()) {
      toast.error(t("nameRequired"));
      return;
    }
    if (components.some((c) => !c.description.trim() || !c.amount)) {
      toast.error(t("componentsRequired"));
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/v1/landed-costs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-organization-id": orgId,
        },
        body: JSON.stringify({
          name,
          purchaseOrderId: purchaseOrderId || null,
          billId: billId || null,
          allocationMethod,
          components: components.map((c) => ({
            description: c.description,
            amountMinor: catalogPriceMinor(c.amount),
            accountId: c.accountId || null,
          })),
        }),
      });

      if (!res.ok) {
        throw new Error();
      }

      const data = await res.json();
      if (typeof data?.allocation?.id !== "string" || !data.allocation.id.trim()) throw new Error();
      toast.success(t("created"));
      setSheetOpen(false);
      resetForm();
      fetchItems();
    } catch {
      toast.error(t("createFailed"));
    } finally {
      setSaving(false);
    }
  }

  async function handleAllocate(id: string) {
    try {
      const res = await fetch(`/api/v1/landed-costs/${id}/allocate`, {
        method: "POST",
        headers: { "x-organization-id": orgId },
      });

      if (!res.ok) {
        throw new Error();
      }

      const data = await res.json();
      if (typeof data?.allocation?.id !== "string" || data.allocation.id !== id || data.allocation.status !== "allocated") throw new Error();
      toast.success(t("allocatedSuccess"));
      fetchItems();
    } catch {
      toast.error(t("allocateFailed"));
    }
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/v1/landed-costs/${id}`, {
        method: "DELETE",
        headers: { "x-organization-id": orgId },
      });

      if (!res.ok) {
        throw new Error();
      }

      const data = await res.json();
      if (data?.success !== true) throw new Error();
      toast.success(t("deleted"));
      fetchItems();
    } catch {
      toast.error(t("deleteFailed"));
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-sm text-muted-foreground">{t("loading")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {readError && <p role="alert" className="text-sm text-destructive">{t("readFailed")}</p>}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="min-w-0 text-lg font-semibold tracking-tight">
            {t("title")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("description")}
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => setSheetOpen(true)}
          className="h-auto whitespace-normal bg-emerald-600 hover:bg-emerald-700"
        >
          <Plus className="me-2 size-4" />
          {t("newAllocation")}
        </Button>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("name")}</TableHead>
              <TableHead>{t("source")}</TableHead>
              <TableHead>{t("method")}</TableHead>
              <TableHead className="text-end">{t("totalCost")}</TableHead>
              <TableHead>{t("status")}</TableHead>
              <TableHead>{t("date")}</TableHead>
              <TableHead className="text-end">{t("actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-center text-muted-foreground py-8"
                >
                  {t("empty")}
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => (
                <TableRow
                  key={item.id}
                  className="cursor-pointer"
                  onClick={() =>
                    router.push(`/purchases/landed-costs/${item.id}`)
                  }
                >
                  <TableCell className="font-medium"><BidiText>{item.name}</BidiText></TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    <BidiText>{item.purchaseOrder?.poNumber ||
                      item.bill?.billNumber ||
                      "-"}</BidiText>
                  </TableCell>
                  <TableCell className="text-sm">
                    <BidiText>{landedCostMethodLabel(t, item.allocationMethod)}</BidiText>
                  </TableCell>
                  <TableCell className="text-end font-mono text-sm tabular-nums">
                    <BidiText>{formatMoney(item.totalCostAmount, item.currencyCode, unitPresentation)}</BidiText>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        item.status === "draft" ? "secondary" : "default"
                      }
                      className={
                        item.status === "allocated"
                          ? "bg-emerald-600 hover:bg-emerald-700"
                          : ""
                      }
                    >
                      <BidiText>{landedCostStatusLabel(t, item.status)}</BidiText>
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    <BidiText>{new Date(item.createdAt).toLocaleDateString()}</BidiText>
                  </TableCell>
                  <TableCell className="text-end">
                    <div
                      className="flex items-center justify-end gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {item.status === "draft" && (
                        <>
                          <Button className="h-auto max-w-full whitespace-normal"
                            variant="outline"
                            size="sm"
                            onClick={() => handleAllocate(item.id)}
                          >
                            {t("allocate")}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            aria-label={t("delete")}
                            onClick={() => handleDelete(item.id)}
                            className="h-auto max-w-full whitespace-normal text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* New Allocation Sheet */}
      <Sheet
        open={sheetOpen}
        onOpenChange={(v) => {
          if (!v) resetForm();
          setSheetOpen(v);
        }}
      >
        <SheetContent dir={localeDirection(unitPresentation.locale)} className="sm:max-w-xl w-full p-0 flex flex-col">
          <SheetHeader className="px-4 pt-4 pb-3 sm:px-6 sm:pt-6 sm:pb-4 border-b">
            <SheetTitle>{t("newAllocation")}</SheetTitle>
          </SheetHeader>
          <form
            onSubmit={handleCreate}
            className="flex flex-col flex-1 overflow-hidden"
          >
            <div className="flex-1 overflow-y-auto space-y-6 px-4 py-4 sm:px-6 sm:py-5">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="rtl042-landed-costs-list-12418" className="text-sm font-medium">{t("requiredName")}</label>
                  <Input id="rtl042-landed-costs-list-12418" aria-label={t("requiredName")} dir="auto"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t("namePlaceholder")}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label htmlFor="rtl042-landed-costs-list-12934" className="text-sm font-medium">
                      {t("purchaseOrderId")}
                    </label>
                    <Input id="rtl042-landed-costs-list-12934" aria-label={t("purchaseOrderId")} dir="auto"
                      value={purchaseOrderId}
                      onChange={(e) => setPurchaseOrderId(e.target.value)}
                      placeholder={t("poIdPlaceholder")}
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="rtl042-landed-costs-list-13367" className="text-sm font-medium">{t("billId")}</label>
                    <Input id="rtl042-landed-costs-list-13367" aria-label={t("billId")} dir="auto"
                      value={billId}
                      onChange={(e) => setBillId(e.target.value)}
                      placeholder={t("billId")}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    {t("allocationMethod")}
                  </label>
                  <Select dir={localeDirection(unitPresentation.locale)}
                    value={allocationMethod}
                    onValueChange={setAllocationMethod}
                  >
                    <SelectTrigger aria-label={t("allocationMethod")} className="h-auto max-w-full whitespace-normal *:data-[slot=select-value]:line-clamp-none">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="by_value">{t("byValue")}</SelectItem>
                      <SelectItem value="by_quantity">{t("byQuantity")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="h-px bg-border" />

              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <label className="text-sm font-medium">
                    {t("requiredComponents")}
                  </label>
                  <Button className="h-auto max-w-full whitespace-normal"
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addComponent}
                  >
                    <Plus className="me-2 size-3.5" />
                    {t("add")}
                  </Button>
                </div>
                {components.map((comp, index) => (
                  <div key={index} className="rounded-lg border p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <span className="text-sm font-medium text-muted-foreground">
                        <BidiText>{t("component", { number: index + 1 })}</BidiText>
                      </span>
                      {components.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          aria-label={t("removeComponent", { number: index + 1 })}
                          onClick={() => removeComponent(index)}
                          className="h-auto max-w-full whitespace-normal text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      )}
                    </div>
                    <div className="space-y-2">
                      <label htmlFor={`rtl042-landed-costs-list-16375-${index}`} className="text-xs font-medium">
                        {t("requiredDescription")}
                      </label>
                      <Input id={`rtl042-landed-costs-list-16375-${index}`} aria-label={t("requiredDescription")} dir="auto"
                        value={comp.description}
                        onChange={(e) =>
                          updateComponent(index, {
                            description: e.target.value,
                          })
                        }
                        placeholder={t("descriptionPlaceholder")}
                      />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-2">
                        <label htmlFor={`rtl042-landed-costs-list-17046-${index}`} className="text-xs font-medium">{t("requiredAmount")}</label>
                        <Input id={`rtl042-landed-costs-list-17046-${index}`} aria-label={t("requiredAmount")} dir="auto"
                          type="number"
                          step="0.01"
                          min="0"
                          value={comp.amount}
                          onChange={(e) =>
                            updateComponent(index, { amount: e.target.value })
                          }
                          placeholder="0.00"
                        />
                      </div>
                      <div className="space-y-2">
                        <label htmlFor={`rtl042-landed-costs-list-17735-${index}`} className="text-xs font-medium">
                          {t("accountId")}
                        </label>
                        <Input id={`rtl042-landed-costs-list-17735-${index}`} aria-label={t("accountId")} dir="auto"
                          value={comp.accountId}
                          onChange={(e) =>
                            updateComponent(index, {
                              accountId: e.target.value,
                            })
                          }
                          placeholder={t("accountId")}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="sticky bottom-0 z-10 flex items-center justify-end gap-3 border-t bg-background/80 px-4 py-3 sm:px-6 sm:py-4 backdrop-blur-sm">
              <Button className="h-auto max-w-full whitespace-normal"
                type="button"
                variant="outline"
                onClick={() => setSheetOpen(false)}
              >
                {t("cancel")}
              </Button>
              <Button
                type="submit"
                disabled={saving}
                className="h-auto whitespace-normal bg-emerald-600 hover:bg-emerald-700"
              >
                {saving ? t("creating") : t("create")}
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}
