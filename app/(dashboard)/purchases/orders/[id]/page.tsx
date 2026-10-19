"use client";

import { useTranslations } from "next-intl";
import { purchaseOrderStatusLabel } from "@/i18n/purchase-order-presentation";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Send, ShoppingCart, Pencil, Trash2, Plus, Package, PackageCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { DatePicker } from "@/components/ui/date-picker";
import { ContactPicker } from "@/components/dashboard/contact-picker";
import { AccountPicker } from "@/components/dashboard/account-picker";
import { BrandLoader } from "@/components/dashboard/brand-loader";
import { ContentReveal } from "@/components/ui/content-reveal";
import { useConfirm } from "@/lib/hooks/use-confirm";
import { useEntityTitle } from "@/lib/hooks/use-entity-title";
import { procurementDocument, procurementMoney, procurementEditPrice, procurementQuantityText, procurementReceiveLines, procurementEditorLines, procurementPreview } from "@/lib/money/procurement-ui";
import type { ProcurementWire } from "@/lib/money/procurement-ui";
import { ProcurementMoneyDetails } from "@/components/dashboard/procurement-money-details";
import { SendDocumentDialog } from "@/components/dashboard/send-document-dialog";
import { EmailHistory } from "@/components/dashboard/email-history";
import Link from "next/link";

interface PODetail {
  currencyCode: string;
  id: string;
  poNumber: string;
  contactId: string;
  issueDate: string;
  deliveryDate: string | null;
  status: string;
  reference: string | null;
  notes: string | null;
  taxTotal: bigint;
  subtotal: bigint;
  total: bigint;
  contact: { name: string; email: string | null } | null;
  lines: {
    id: string;
    description: string;
    quantity: number;
    quantityReceived: number;
    quantityBilled: number;
    unitPrice: bigint;
    amount: bigint;
    account: { id: string; code: string; name: string } | null;
    taxRate: { id: string } | null;
  }[];
}

interface EditLine {
  description: string;
  quantity: string;
  unitPrice: string;
  accountId: string;
  taxRateId: string;
}

const statusConfig: Record<string, { class: string }> = {
  draft: { class: "" },
  sent: { class: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300" },
  partial: { class: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300" },
  received: { class: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" },
  closed: { class: "border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-300" },
  void: { class: "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300" },
};



// ---------------------------------------------------------------------------
// Drawer helper components
// ---------------------------------------------------------------------------

function DrawerIcon({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
      {children}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </p>
  );
}

function DrawerFooter({
  onClose,
  saving,
  label,
  disabled = false,
}: {
  onClose: () => void;
  saving: boolean;
  label: string;
  disabled?: boolean;
}) {
  const t = useTranslations("PurchaseOrders");
  return (
    <div className="sticky bottom-0 z-10 flex items-center justify-end gap-3 border-t bg-background/80 px-4 py-3 sm:px-6 sm:py-4 backdrop-blur-sm">
      <Button type="button" variant="outline" onClick={onClose}>
        {t("cancel")}

      </Button>
      <Button
        type="submit"
        disabled={saving || disabled}
        className="bg-emerald-600 hover:bg-emerald-700"
      >
        {saving ? t("saving") : label}
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Edit PO Drawer
// ---------------------------------------------------------------------------

function EditPODrawer({
  open,
  onClose,
  po,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  po: PODetail;
  onSaved: () => void;
}) {
  const t = useTranslations("PurchaseOrders");
  const [saving, setSaving] = useState(false);
  const [contactId, setContactId] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<EditLine[]>([]);

  useEffect(() => {
    if (open) {
      setContactId(po.contactId);
      setIssueDate(po.issueDate);
      setDeliveryDate(po.deliveryDate || "");
      setNotes(po.notes || "");
      setLines(
        po.lines.map((l) => ({
          description: l.description,
          quantity: procurementQuantityText(l.quantity),
          unitPrice: procurementEditPrice(l.unitPrice, po.currencyCode),
          accountId: l.account?.id || "",
          taxRateId: l.taxRate?.id || "",
        }))
      );
    }
  }, [open, po]);

  function updateLine(index: number, updates: Partial<EditLine>) {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...updates } : l)));
  }

  function addLine() {
    setLines((prev) => [...prev, { description: "", quantity: "1", unitPrice: "", accountId: "", taxRateId: "" }]);
  }

  function removeLine(index: number) {
    if (lines.length <= 1) return;
    setLines((prev) => prev.filter((_, i) => i !== index));
  }

  const preview = procurementPreview(lines, po.currencyCode, [], "purchaseOrderUpdate");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    const orgId = localStorage.getItem("activeOrgId");
    if (!orgId || !contactId) {
      toast.error(t("supplierRequired"));
      return;
    }
    if (preview.error || lines.some((l) => !l.description.trim())) {
      toast.error(t("checkLines"));
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/v1/purchase-orders/${po.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-organization-id": orgId },
        body: JSON.stringify({
          contactId,
          issueDate,
          deliveryDate: deliveryDate || null,
          notes: notes || null,
          lines: procurementEditorLines(lines, "purchaseOrderUpdate"),
        }),
      });

      if (!res.ok) throw new Error("Update failed");
      const data = await res.json();
      if (data?.purchaseOrder?.id !== po.id) throw new Error("Invalid saved order");

      toast.success(t("updated"));
      onClose();
      onSaved();
    } catch {
      toast.error(t("updateFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="sm:max-w-2xl w-full p-0 flex flex-col">
        <SheetHeader className="px-4 pt-4 pb-3 sm:px-6 sm:pt-6 sm:pb-4 border-b space-y-3">
          <div className="flex items-center gap-3">
            <DrawerIcon><Package className="size-5" /></DrawerIcon>
            <div>
              <SheetTitle className="text-lg">{t("editTitle")}</SheetTitle>
              <SheetDescription>{t("editDescription")}</SheetDescription>
            </div>
          </div>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto space-y-6 px-4 py-4 sm:px-6 sm:py-5">
            <div className="space-y-4">
              <SectionLabel>{t("orderDetails")}</SectionLabel>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>{t("requiredSupplier")}</Label>
                  <ContactPicker value={contactId} onChange={setContactId} type="supplier" />
                </div>
                <div className="space-y-2">
                  <Label>{t("issueDate")}</Label>
                  <DatePicker value={issueDate} onChange={setIssueDate} placeholder={t("issueDatePlaceholder")} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>{t("deliveryDate")}</Label>
                <DatePicker value={deliveryDate} onChange={setDeliveryDate} placeholder={t("expectedDelivery")} />
              </div>
            </div>

            <div className="h-px bg-border" />

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <SectionLabel>{t("lineItems")}</SectionLabel>
                <Button type="button" variant="outline" size="sm" onClick={addLine}>
                  <Plus className="mr-2 size-3.5" />{t("addLine")}
                </Button>
              </div>
              <div className="space-y-4">
                {lines.map((line, index) => (
                  <div key={index} className="rounded-lg border p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-muted-foreground">{t("line", { line: index + 1 })}</span>
                      {lines.length > 1 && (
                        <Button type="button" variant="ghost" size="sm" onClick={() => removeLine(index)} aria-label={t("removeLine", { line: index + 1 })} className="text-red-600 hover:text-red-700">
                          <Trash2 className="size-4" />
                        </Button>
                      )}
                    </div>
                    <div className="grid gap-4 sm:grid-cols-3">
                      <div className="space-y-2 sm:col-span-3">
                        <Label className="text-xs">{t("requiredDescription")}</Label>
                        <Input aria-label={t("lineDescription", { line: index + 1 })} value={line.description} onChange={(e) => updateLine(index, { description: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">{t("quantity")}</Label>
                        <Input type="number" step="any" aria-label={t("lineQuantity", { line: index + 1 })} value={line.quantity} onChange={(e) => updateLine(index, { quantity: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">{t("unitPrice", { currency: po.currencyCode })}</Label>
                        <Input inputMode="decimal" aria-label={t("linePrice", { line: index + 1 })} value={line.unitPrice} onChange={(e) => updateLine(index, { unitPrice: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">{t("account")}</Label>
                        <AccountPicker value={line.accountId} onChange={(val) => updateLine(index, { accountId: val })} typeFilter={["expense"]} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="h-px bg-border" />

            <p className="text-sm">{t("editPolicy")}</p>
            {preview.error ? <p role="alert" className="text-sm text-red-600">{t("checkLines")}</p> : <p className="text-right font-mono break-all">{t("previewTotal", { amount: procurementMoney(preview.total, po.currencyCode) })}</p>}
            <div className="space-y-4">
              <SectionLabel>{t("notes")}</SectionLabel>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t("internalNotes")} rows={3} />
            </div>
          </div>
          <DrawerFooter onClose={onClose} saving={saving} disabled={!!preview.error || !contactId || lines.some(line => !line.description.trim())} label={t("saveChanges")} />
        </form>
      </SheetContent>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function PODetailPage() {
  const { id } = useParams<{ id: string }>();
  const orgId = typeof window !== "undefined" ? localStorage.getItem("activeOrgId") : null;
  return <PODetailContent key={`${orgId}:${id}`} />;
}

function PODetailContent() {
  const t = useTranslations("PurchaseOrders");
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const [po, setPo] = useState<PODetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [readError, setReadError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [emailHistoryKey, setEmailHistoryKey] = useState(0);
  const [orgName, setOrgName] = useState("");
  const [acting, setActing] = useState(false);
  const orgId = typeof window !== "undefined" ? localStorage.getItem("activeOrgId") : null;

  useEntityTitle(po?.poNumber);

  const loadPO = useCallback(async (signal?: AbortSignal) => {
    if (!orgId) return;
    try {
      const res = await fetch(`/api/v1/purchase-orders/${id}`, { headers: { "x-organization-id": orgId }, signal });
      if (!res.ok) throw new Error("Could not load purchase order");
      const data = await res.json();
      if (!signal?.aborted) { setPo(procurementDocument(data.purchaseOrder as ProcurementWire<PODetail>)); setReadError(null); }
    } catch { if (!signal?.aborted) { setPo(null); setReadError("detailReadFailed"); } }
    finally { if (!signal?.aborted) setLoading(false); }
  }, [id, orgId]);

  useEffect(() => {
    const controller = new AbortController();
    void loadPO(controller.signal);
    if (orgId) {
      fetch("/api/v1/organization", { headers: { "x-organization-id": orgId }, signal: controller.signal })
        .then(r => r.json()).then(data => { if (!controller.signal.aborted) setOrgName(data.organization?.name || ""); }).catch(() => {});
    }
    return () => controller.abort();
  }, [loadPO, orgId]);

  function handleSendComplete() {
    loadPO();
    setEmailHistoryKey((k) => k + 1);
  }

  async function handleConvert() {
    if (!orgId || acting) return;
    setActing(true);
    try {
      const res = await fetch(`/api/v1/purchase-orders/${id}/convert`, { method: "POST", headers: { "x-organization-id": orgId } });
      if (!res.ok) throw new Error("Conversion failed");
      const data = await res.json();
      if (typeof data?.bill?.id !== "string" || !data.bill.id.trim()) throw new Error("Invalid bill");
      toast.success(t("converted"));
      router.push(`/purchases/${data.bill.id}`);
    } catch {
      toast.error(t("convertFailed"));
    } finally {
      setActing(false);
    }
  }

  // Record that the items you ordered have arrived (for the quantities still
  // outstanding on each line). Adds stock you track to your inventory.
  async function handleReceiveItems() {
    if (!orgId || !po || acting) return;
    setActing(true);
    try {
      const linesToReceive = procurementReceiveLines(po.lines);

      if (linesToReceive.length === 0) {
        toast.info(t("alreadyReceived"));
        return;
      }

      const confirmed = await confirm({
        title: t("receiveTitle"),
        description: t("receiveDescription"),
        confirmLabel: t("receive"),
      });
      if (!confirmed) return;

      const res = await fetch(`/api/v1/goods-receipts`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-organization-id": orgId },
        body: JSON.stringify({
          purchaseOrderId: id,
          date: new Date().toISOString().split("T")[0],
          lines: linesToReceive,
        }),
      });
      if (!res.ok) throw new Error("Receipt failed");
      const data = await res.json();
      if (typeof data?.goodsReceipt?.id !== "string" || !data.goodsReceipt.id.trim()) throw new Error("Invalid receipt");
      toast.success(t("receivedSuccess"));
      void loadPO();
    } catch {
      toast.error(t("receiveFailed"));
    } finally {
      setActing(false);
    }
  }

  async function handleDelete() {
    if (!orgId || acting) return;
    setActing(true);
    try {
      const confirmed = await confirm({
        title: t("deleteTitle"),
        description: t("deleteDescription"),
        confirmLabel: t("delete"),
        destructive: true,
      });
      if (!confirmed) return;
      const res = await fetch(`/api/v1/purchase-orders/${id}`, {
        method: "DELETE",
        headers: { "x-organization-id": orgId },
      });
      if (!res.ok) throw new Error("Delete failed");
      const data = await res.json();
      if (data?.success !== true) throw new Error("Invalid deletion");
      toast.success(t("deleted"));
      router.push("/purchases/orders");
    } catch {
      toast.error(t("deleteFailed"));
    } finally {
      setActing(false);
    }
  }

  if (readError) return <p role="alert" className="text-sm text-red-600">{t("detailReadFailed")}</p>;
  if (loading) return <BrandLoader />;

  if (!po) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <p className="text-sm text-muted-foreground">{t("notFound")}</p>
        <Button variant="ghost" size="sm" asChild className="mt-2">
          <Link href="/purchases/orders">{t("back")}</Link>
        </Button>
      </div>
    );
  }

  const sc = Object.hasOwn(statusConfig, po.status) ? statusConfig[po.status] : statusConfig.draft;

  return (
    <ContentReveal>
      <div className="space-y-6">
        {/* Top bar */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild className="size-8 p-0" aria-label={t("back")}>
              <Link href="/purchases/orders"><ArrowLeft className="size-4" /></Link>
            </Button>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-lg font-semibold tracking-tight">{po.poNumber}</h1>
                <Badge variant="outline" className={sc.class}>{purchaseOrderStatusLabel(t, po.status)}</Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">
                {po.contact?.name || t("unknownSupplier")}
                {po.deliveryDate && <span>{t("deliveryInline", { date: po.deliveryDate })}</span>}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {po.status === "draft" && (
              <>
                <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
                  <Pencil className="mr-2 size-3.5" />{t("edit")}
                </Button>
                <Button size="sm" onClick={() => setSendDialogOpen(true)} className="bg-emerald-600 hover:bg-emerald-700">
                  <Send className="mr-2 size-3.5" />{t("send")}
                </Button>
                <Button variant="outline" size="sm" disabled={acting} onClick={handleDelete} className="text-red-600 hover:text-red-700">
                  <Trash2 className="mr-2 size-3.5" />{t("delete")}
                </Button>
              </>
            )}
            {["sent", "partial"].includes(po.status) && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleReceiveItems}
                disabled={acting}
                title={t("receiveHint")}
              >
                <PackageCheck className="mr-2 size-3.5" />{t("receive")}
              </Button>
            )}
            {["sent", "partial", "received"].includes(po.status) && (
              <Button size="sm" disabled={acting} onClick={handleConvert} className="bg-emerald-600 hover:bg-emerald-700" title={t("convertHint")}>
                <ShoppingCart className="mr-2 size-3.5" />{t("convert")}
              </Button>
            )}
          </div>
        </div>

        {/* Gradient divider */}
        <div className="h-px bg-gradient-to-r from-blue-500/20 via-border to-transparent" />

        {/* Info */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <span>{t("issued", { date: po.issueDate })}</span>
          {po.deliveryDate && <span>{t("deliveryOn", { date: po.deliveryDate })}</span>}
        </div>

        {po.notes && (
          <div className="rounded-lg border p-4">
            <p className="text-xs text-muted-foreground mb-1">{t("notes")}</p>
            <p className="text-sm">{po.notes}</p>
          </div>
        )}

        {/* Summary cards */}
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-3">
          <div className="rounded-lg border bg-card p-4">
            <p className="text-xs text-muted-foreground">{t("total")}</p>
            <p className="mt-1 text-xl font-bold font-mono tabular-nums break-all">{procurementMoney(po.total, po.currencyCode)}</p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="text-xs text-muted-foreground">{t("items")}</p>
            <p className="mt-1 text-xl font-bold font-mono tabular-nums">{po.lines.length}</p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="text-xs text-muted-foreground">{t("supplier")}</p>
            <p className="mt-1 text-xl font-bold truncate">{po.contact?.name || "-"}</p>
          </div>
        </div>

        <ProcurementMoneyDetails document={po} />
      </div>

      <EmailHistory key={emailHistoryKey} documentType="purchase_order" documentId={id} />

      {/* Edit PO Drawer */}
      <EditPODrawer
        open={editOpen}
        onClose={() => setEditOpen(false)}
        po={po}
        onSaved={() => { void loadPO(); }}
      />

      <SendDocumentDialog
        open={sendDialogOpen}
        onOpenChange={setSendDialogOpen}
        documentType="purchase_order"
        documentId={id}
        documentNumber={po.poNumber}
        contactEmail={po.contact?.email}
        contactName={po.contact?.name}
        organizationName={orgName}
        amountDue={po.total}
        currencyCode={po.currencyCode}
        issueDate={po.issueDate}
        sendApiUrl={`/api/v1/purchase-orders/${id}/send`}
        onSent={handleSendComplete}
      />

      {confirmDialog}
    </ContentReveal>
  );
}
