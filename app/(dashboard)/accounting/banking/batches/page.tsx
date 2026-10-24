"use client";
import { BidiText, IdentifierText } from "@/components/ui/bidi-text";

import { usePresentation } from "@/i18n/provider";
import { currencyLabel } from "@/i18n/currency-labels";
import { useTranslations } from "next-intl";
import { bankPaymentStatus, paymentFailure, requirePaymentResponse } from "@/i18n/bank-payment-presentation";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Layers,
  ChevronRight,
  Loader2,
  FileStack,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ContentReveal } from "@/components/ui/content-reveal";
import { BrandLoader } from "@/components/dashboard/brand-loader";
import { paymentUiMoney as formatMoney, paymentUiDecimal, paymentUiBill, paymentUiBatch, paymentUiBatchInput } from "@/lib/money/payment-ui";
import { cn } from "@/lib/utils";
import { useDocumentTitle } from "@/lib/hooks/use-document-title";

interface BatchItem {
  id: string;
  billId: string | null;
  contactId: string | null;
  amount: bigint;
  status: string;
}

interface Batch {
  id: string;
  name: string;
  status: "draft" | "submitted" | "completed";
  totalAmount: bigint;
  currencyCode: string;
  paymentCount: number;
  submittedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  items: BatchItem[];
}

interface BillOption {
  id: string;
  billNumber: string;
  total: bigint;
  amountDue: bigint;
  currencyCode: string;
  contactId: string;
  contact: { id: string; name: string } | null;
}

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "outline"> = {
  draft: "secondary",
  submitted: "default",
  completed: "outline",
};

export default function PaymentBatchesPage() {
  const orgId = typeof window !== "undefined" ? localStorage.getItem("activeOrgId") : null;
  return <PaymentBatchesList key={orgId} orgId={orgId} />;
}
function PaymentBatchesList({ orgId }: { orgId: string | null }) {
  const unitPresentation = usePresentation();
  const t = useTranslations("BankPayments");
  const errors = useTranslations("BankAccountErrors");
  const router = useRouter();
  const [batches, setBatches] = useState<Batch[]>([]);
  const [readError, setReadError] = useState("");
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [saving, setSaving] = useState(false);

  // Dialog form
  const [batchName, setBatchName] = useState("");
  const [bills, setBills] = useState<BillOption[]>([]);
  const [selectedBills, setSelectedBills] = useState<
    { billId: string; contactId: string; amount: string; currencyCode: string }[]
  >([]);

  useDocumentTitle(t("batchesTitle"));

  const fetchBatches = useCallback((signal?: AbortSignal) => {
    if (!orgId) return;
    fetch("/api/v1/payment-batches", {
      headers: { "x-organization-id": orgId }, signal,
    })
      .then((res) => { if (!res.ok) throw new Error("Unable to load payments"); return res.json(); })
      .then((data) => { const rows = (data.data || []).map(paymentUiBatch) as Batch[]; if (!signal?.aborted) { setBatches(rows); setReadError(""); } })
      .catch(() => { if (!signal?.aborted) { setBatches([]); setReadError(t("batchesUnavailable")); } })
      .finally(() => { if (!signal?.aborted) setLoading(false); });
  }, [orgId, t]);

  const fetchBills = useCallback((signal?: AbortSignal) => {
    if (!orgId) return;
    fetch("/api/v1/bills?limit=100", {
      headers: { "x-organization-id": orgId }, signal,
    })
      .then((res) => { if (!res.ok) throw new Error("Unable to load payments"); return res.json(); })
      .then((data) => { const rows = (data.data || []).map(paymentUiBill) as BillOption[]; if (!signal?.aborted) setBills(rows.filter(b => b.amountDue > 0n && ["received", "partial", "overdue"].includes((b as BillOption & { status: string }).status))); })
      .catch(() => { if (!signal?.aborted) { setBills([]); toast.error(t("billsUnavailable")); } });
  }, [orgId, t]);

  useEffect(() => {
    const controller = new AbortController();
    fetchBatches(controller.signal);
    return () => controller.abort();
  }, [fetchBatches]);

  function openCreateDialog() {
    setBatchName("");
    setSelectedBills([]);
    setBills([]);
    setShowDialog(true);
  }

  useEffect(() => {
    if (!showDialog) return;
    const controller = new AbortController();
    fetchBills(controller.signal);
    return () => controller.abort();
  }, [showDialog, fetchBills]);

  let preview: ReturnType<typeof paymentUiBatchInput> | null = null;
  let previewError = "";
  try { if (selectedBills.length) preview = paymentUiBatchInput(selectedBills, bills); }
  catch (error) { previewError = paymentFailure(error, t, t("invalidBatch")); }

  function toggleBill(bill: BillOption) {
    setSelectedBills((prev) => {
      const existing = prev.find((b) => b.billId === bill.id);
      if (existing) {
        return prev.filter((b) => b.billId !== bill.id);
      }
      return [
        ...prev,
        {
          billId: bill.id,
          contactId: bill.contactId,
          amount: paymentUiDecimal(bill.amountDue, bill.currencyCode),
          currencyCode: bill.currencyCode,
        },
      ];
    });
  }

  function updateBillAmount(billId: string, amount: string) {
    setSelectedBills((prev) =>
      prev.map((b) => (b.billId === billId ? { ...b, amount } : b))
    );
  }

  async function handleCreateBatch() {
    if (!orgId || !batchName || !preview) return;
    setSaving(true);

    try {
      const res = await fetch("/api/v1/payment-batches", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-organization-id": orgId,
        },
        body: JSON.stringify({
          name: batchName,
          currencyCode: preview.currencyCode,
          items: preview.items,
        }),
      });

      await requirePaymentResponse(res, t, errors, t("createFailed"));

      toast.success(t("batchCreated"));
      setShowDialog(false);
      fetchBatches();
    } catch (error) {
      toast.error(paymentFailure(error, t, t("createFailed")));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <BrandLoader />;

  return (
    <ContentReveal className="space-y-6">
      {readError && <p role="alert">{readError}</p>}
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">{t("batchesHeading")}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">{t("batchesHint")}</p>
        </div>
        <Button size="sm" onClick={openCreateDialog} className="h-auto min-h-8 min-w-0 whitespace-normal bg-emerald-600 hover:bg-emerald-700 text-xs">
          <Plus className="me-1.5 size-3.5" />{t("createBatch")}</Button>
      </div>

      {/* Empty state */}
      {batches.length === 0 && (
        <div className="flex flex-col items-center gap-4 py-16">
          <div className="flex size-12 items-center justify-center rounded-xl bg-muted">
            <Layers className="size-6 text-muted-foreground" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium">{t("noBatches")}</p>
            <p className="text-xs text-muted-foreground mt-1">{t("noBatchesHint")}</p>
          </div>
          <Button
            size="sm"
            onClick={openCreateDialog}
            className="h-auto min-h-8 min-w-0 whitespace-normal bg-emerald-600 hover:bg-emerald-700"
          >
            <Plus className="me-2 size-4" />{t("createBatch")}</Button>
        </div>
      )}

      {/* Batch list */}
      {batches.length > 0 && (
        <div className="rounded-xl border bg-card overflow-hidden divide-y divide-border">
          {batches.map((batch) => (
            <button
              key={batch.id}
              type="button"
              onClick={() =>
                router.push(`/accounting/banking/batches/${batch.id}`)
              }
              className="group flex w-full items-center gap-3 px-4 py-3.5 text-start transition-colors hover:bg-muted/40"
            >
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
                <FileStack className="size-4" />
              </div>
              <div className="min-w-0 flex-1 basis-40">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium min-w-0 whitespace-normal [overflow-wrap:anywhere]"><BidiText>{batch.name}</BidiText></p>
                  <Badge
                    variant={STATUS_VARIANTS[batch.status] || "secondary"}
                    className="text-[10px] capitalize"
                  >
                    {bankPaymentStatus(t, batch.status)}
                  </Badge>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                  <span>
                    {t("paymentCount", { count: batch.paymentCount })}
                  </span>
                  <span className="text-border">{"\u00B7"}</span>
                  <span>
                    {new Date(batch.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3 shrink-0">
                <p className="font-mono text-sm font-semibold tabular-nums break-all">
                  <BidiText>{formatMoney(batch.totalAmount, batch.currencyCode, unitPresentation)}</BidiText>
                </p>
                <ChevronRight className="size-4 text-muted-foreground/0 transition-all group-hover:text-muted-foreground [&:dir(rtl)]:rotate-180 ltr:group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5" />
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Create Batch Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("createBatchTitle")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-xs">{t("batchName")}</Label>
              <Input value={batchName} onChange={(e) => setBatchName(e.target.value)} placeholder={t("batchNamePlaceholder")} dir="auto" aria-label={t("batchName")} />
            </div>

            <div className="space-y-2">
              <Label className="text-xs">
                {t("selectBills", { count: selectedBills.length })}
              </Label>
              <div className="max-h-[240px] overflow-y-auto rounded-lg border divide-y divide-border">
                {bills.length === 0 && (
                  <p className="text-xs text-muted-foreground p-3 text-center">{t("noUnpaid")}</p>
                )}
                {bills.map((b) => {
                  const isSelected = selectedBills.some(
                    (s) => s.billId === b.id
                  );
                  const selectedItem = selectedBills.find(
                    (s) => s.billId === b.id
                  );
                  return (
                    <div key={b.id} className="px-3 py-2.5">
                      <button
                        className="flex w-full items-center gap-2 text-start"
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => toggleBill(b)}
                      >
                        <div
                          className={cn(
                            "size-4 rounded border flex items-center justify-center transition-colors",
                            isSelected
                              ? "bg-emerald-600 border-emerald-600"
                              : "border-border"
                          )}
                        >
                          {isSelected && (
                            <svg
                              className="size-3 text-white"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={3}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                          )}
                        </div>
                        <div className="min-w-0 flex-1 basis-40">
                          <p className="text-xs font-medium">
                            <IdentifierText>{b.billNumber}</IdentifierText> - <BidiText>{b.contact?.name || t("unknown")}</BidiText>
                          </p>
                        </div>
                        <p className="text-xs font-mono tabular-nums text-muted-foreground">
                          <BidiText>{formatMoney(b.amountDue, b.currencyCode, unitPresentation)}</BidiText>
                        </p>
                      </button>
                      {isSelected && selectedItem && (
                        <div className="mt-2 ms-6">
                          <Input type="text" inputMode="decimal" aria-label={t("paymentBillAmount", { bill: b.billNumber, currency: currencyLabel(b.currencyCode, unitPresentation.locale) })} value={selectedItem.amount} onChange={(e) =>
                              updateBillAmount(b.id, e.target.value)
                            } className="h-7 text-xs" placeholder={t("amount")} dir="ltr" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {selectedBills.length > 0 && (
              <div className="flex items-center justify-between pt-2 border-t">
                <p className="text-xs text-muted-foreground">{t("total")}</p>
                <p className="text-sm font-mono font-semibold tabular-nums">
                  <BidiText>{preview ? formatMoney(preview.total, preview.currencyCode, unitPresentation) : t("unavailable")}</BidiText>
                </p>
              </div>
            )}
          </div>
          {previewError && <p role="alert" className="text-sm text-destructive">{previewError}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)} className="h-auto min-h-8 min-w-0 whitespace-normal">{t("cancel")}</Button>
            <Button
              onClick={handleCreateBatch}
              disabled={
                saving || !batchName || !preview
              }
              className="h-auto min-h-8 min-w-0 whitespace-normal bg-emerald-600 hover:bg-emerald-700"
            >
              {saving && <Loader2 className="me-2 size-4 animate-spin" />}
              {t("createBatch")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ContentReveal>
  );
}
