"use client";

import { usePresentation } from "@/i18n/provider";
import { currencyLabel } from "@/i18n/currency-labels";
import { useTranslations } from "next-intl";
import { bankPaymentStatus, paymentFailure, requirePaymentResponse } from "@/i18n/bank-payment-presentation";

import { useEffect, useState, useMemo, useCallback, useRef, useEffectEvent } from "react";
import {
  Calendar,
  Plus,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ContentReveal } from "@/components/ui/content-reveal";
import { PaymentAmountPreview } from "@/components/dashboard/payment-amount-preview";
import { BrandLoader } from "@/components/dashboard/brand-loader";
import { paymentUiMoney as formatMoney, paymentUiScheduled, paymentUiBill, paymentUiBillAmount, paymentUiDecimal } from "@/lib/money/payment-ui";
import { cn } from "@/lib/utils";
import { useDocumentTitle } from "@/lib/hooks/use-document-title";

interface ScheduledPaymentItem {
  id: string;
  billId: string | null;
  contactId: string | null;
  amount: bigint;
  currencyCode: string;
  scheduledDate: string;
  status: "pending" | "processing" | "completed" | "failed" | "cancelled";
  processedAt: string | null;
  notes: string | null;
  createdAt: string;
  bill: {
    id: string;
    billNumber: string;
    total: bigint;
    amountDue: bigint;
    contact: { id: string; name: string } | null;
  } | null;
  contact: { id: string; name: string } | null;
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

const STATUS_CONFIG: Record<
  string,
  { variant: "default" | "secondary" | "outline" | "destructive"; icon: React.ElementType }
> = {
  pending: { variant: "secondary", icon: Clock },
  processing: { variant: "default", icon: Loader2 },
  completed: { variant: "outline", icon: CheckCircle2 },
  failed: { variant: "destructive", icon: AlertCircle },
  cancelled: { variant: "outline", icon: XCircle },
};

function getWeekLabel(dateStr: string) {
  const date = new Date(dateStr + "T00:00:00");
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.floor(
    (date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (diff < 0) return "overdue" as const;
  if (diff === 0) return "today" as const;
  if (diff <= 7) return "thisWeek" as const;
  if (diff <= 14) return "nextWeek" as const;
  if (diff <= 30) return "thisMonth" as const;
  return "later" as const;
}

export default function ScheduledPaymentsPage() {
  const orgId = typeof window !== "undefined" ? localStorage.getItem("activeOrgId") : null;
  return <ScheduledPaymentsList key={orgId} orgId={orgId} />;
}
function ScheduledPaymentsList({ orgId }: { orgId: string | null }) {
  const unitPresentation = usePresentation();
  const t = useTranslations("BankPayments");
  const errors = useTranslations("BankAccountErrors");
  const [items, setItems] = useState<ScheduledPaymentItem[]>([]);
  const [readError, setReadError] = useState("");
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showDialog, setShowDialog] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Dialog form state
  const [bills, setBills] = useState<BillOption[]>([]);
  const [selectedBillId, setSelectedBillId] = useState("");
  const [amount, setAmount] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [notes, setNotes] = useState("");

  useDocumentTitle(t("scheduledTitle"));

  const generation = useRef(0);
  const latestFetch = useRef<() => void>(() => {});
  const fetchItems = useCallback((signal?: AbortSignal) => {
    if (!orgId) return;
    const requestGeneration = ++generation.current;
    const params = new URLSearchParams();
    if (statusFilter !== "all") params.set("status", statusFilter);

    fetch(`/api/v1/scheduled-payments?${params}`, {
      headers: { "x-organization-id": orgId }, signal,
    })
      .then((res) => { if (!res.ok) throw new Error("Unable to load payments"); return res.json(); })
      .then((data) => { const rows = (data.data || []).map(paymentUiScheduled) as ScheduledPaymentItem[]; if (!signal?.aborted && requestGeneration === generation.current) { setItems(rows); setReadError(""); } })
      .catch(() => { if (!signal?.aborted && requestGeneration === generation.current) { setItems([]); setReadError(t("scheduledUnavailable")); } })
      .finally(() => { if (!signal?.aborted && requestGeneration === generation.current) setLoading(false); });
  }, [orgId, statusFilter, t]);

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
    fetchItems(controller.signal);
    return () => controller.abort();
  }, [fetchItems]);

  useEffect(() => {
    if (!showDialog) return;
    const controller = new AbortController();
    fetchBills(controller.signal);
    return () => controller.abort();
  }, [showDialog, fetchBills]);

  useEffect(() => { latestFetch.current = fetchItems; }, [fetchItems]);

  const notifyProcessed = useEffectEvent((data: { processed: number; failed: number }) => {
    if (data.processed > 0) toast.success(t("processedScheduled", { count: data.processed }));
    if (data.failed > 0) toast.error(t("failedScheduled", { count: data.failed }));
  });

  // Preserve initial processing; changing a list filter never posts cash again.
  useEffect(() => {
    if (!orgId) return;
    const controller = new AbortController();
    fetch("/api/v1/scheduled-payments/process", {
      method: "POST", headers: { "x-organization-id": orgId }, signal: controller.signal,
    }).then(res => res.json()).then(data => {
      if (controller.signal.aborted) return;
      notifyProcessed(data);
    }).catch(() => {}).finally(() => { if (!controller.signal.aborted) latestFetch.current(); });
    return () => controller.abort();
  }, [orgId]);

  // Group by week
  const grouped = useMemo(() => {
    const groups: Record<string, ScheduledPaymentItem[]> = {};
    const order: ReturnType<typeof getWeekLabel>[] = ["overdue", "today", "thisWeek", "nextWeek", "thisMonth", "later"];

    for (const item of items) {
      const label = getWeekLabel(item.scheduledDate);
      if (!groups[label]) groups[label] = [];
      groups[label].push(item);
    }

    return order
      .filter((label) => groups[label])
      .map((label) => ({ label, items: groups[label] }));
  }, [items]);

  async function handleSchedule() {
    if (!orgId || !selectedBillId || !scheduledDate || !amount) return;
    const selectedBill = bills.find((b) => b.id === selectedBillId);
    if (!selectedBill) return;
    let amountMinor: string;
    try {
      amountMinor = paymentUiBillAmount(amount, selectedBill).amountMinor;
    } catch (error) {
      toast.error(paymentFailure(error, t, t("invalidPayment")));
      return;
    }
    setSaving(true);

    try {
      const res = await fetch("/api/v1/scheduled-payments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-organization-id": orgId,
        },
        body: JSON.stringify({
          billId: selectedBillId,
          contactId: selectedBill.contactId,
          currencyCode: selectedBill.currencyCode,
          amountMinor,
          scheduledDate,
          notes: notes || null,
        }),
      });

      await requirePaymentResponse(res, t, errors, t("scheduleFailed"));

      toast.success(t("scheduled"));
      setShowDialog(false);
      resetForm();
      fetchItems();
    } catch (error) {
      toast.error(paymentFailure(error, t, t("scheduleFailed")));
    } finally {
      setSaving(false);
    }
  }

  async function handleCancel(id: string) {
    if (!orgId) return;
    try {
      const res = await fetch(`/api/v1/scheduled-payments/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-organization-id": orgId,
        },
        body: JSON.stringify({ status: "cancelled" }),
      });

      if (!res.ok) {
        await requirePaymentResponse(res, t, errors, t("cancelFailed"));
        return;
      }

      toast.success(t("scheduleCancelled"));
      fetchItems();
    } catch (error) {
      toast.error(paymentFailure(error, t, t("cancelFailed")));
    }
  }

  async function handleProcessNow() {
    if (!orgId) return;
    setProcessing(true);
    try {
      const res = await fetch("/api/v1/scheduled-payments/process", {
        method: "POST",
        headers: { "x-organization-id": orgId },
      });
      await requirePaymentResponse(res, t, errors, t("processFailed"));
      const data = await res.json();
      if (data.processed > 0) {
        toast.success(t("processedPayments", { count: data.processed }));
      } else if (!data.failed) {
        toast.info(t("noneDue"));
      }
      if (data.failed > 0) {
        toast.error(t("failedPayments", { count: data.failed }));
      }
      fetchItems();
    } catch (error) {
      toast.error(paymentFailure(error, t, t("processFailed")));
    } finally {
      setProcessing(false);
    }
  }

  function resetForm() {
    setSelectedBillId("");
    setAmount("");
    setScheduledDate("");
    setNotes("");
  }

  function openScheduleDialog() {
    resetForm();
    setBills([]);
    setShowDialog(true);
  }

  const selectedBill = bills.find(b => b.id === selectedBillId);
  let preview: string | null = null;
  try { if (selectedBill) preview = paymentUiBillAmount(amount, selectedBill).amountMinor; } catch {}

  if (loading) return <BrandLoader />;

  return (
    <ContentReveal className="space-y-6">
      {readError && <p role="alert">{readError}</p>}
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">{t("scheduledHeading")}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">{t("scheduledHint")}</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-8 w-[130px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("allStatuses")}</SelectItem>
              <SelectItem value="pending">{t("pending")}</SelectItem>
              <SelectItem value="completed">{t("completed")}</SelectItem>
              <SelectItem value="cancelled">{t("cancelled")}</SelectItem>
              <SelectItem value="failed">{t("failed")}</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={handleProcessNow}
            disabled={processing}
            className="h-8 text-xs"
          >
            {processing ? (
              <Loader2 className="mr-1.5 size-3.5 animate-spin" />
            ) : (
              <CheckCircle2 className="mr-1.5 size-3.5" />
            )}
            {t("processDue")}
          </Button>
          <Button
            size="sm"
            onClick={openScheduleDialog}
            className="h-8 bg-emerald-600 hover:bg-emerald-700 text-xs"
          >
            <Plus className="mr-1.5 size-3.5" />{t("schedulePayment")}</Button>
        </div>
      </div>

      {/* Empty state */}
      {items.length === 0 && (
        <div className="flex flex-col items-center gap-4 py-16">
          <div className="flex size-12 items-center justify-center rounded-xl bg-muted">
            <Calendar className="size-6 text-muted-foreground" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium">{t("noScheduled")}</p>
            <p className="text-xs text-muted-foreground mt-1">{t("noScheduledHint")}</p>
          </div>
          <Button
            size="sm"
            onClick={openScheduleDialog}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            <Plus className="mr-2 size-4" />{t("schedulePayment")}</Button>
        </div>
      )}

      {/* Grouped list */}
      {grouped.map((group) => (
        <div key={group.label} className="space-y-2">
          <div className="flex items-center gap-2">
            <p
              className={cn(
                "text-xs font-medium uppercase tracking-wider",
                group.label === "overdue"
                  ? "text-red-600 dark:text-red-400"
                  : "text-muted-foreground"
              )}
            >
              {t(group.label)}
            </p>
            <span className="text-xs text-muted-foreground/50 tabular-nums">
              ({group.items.length})
            </span>
          </div>

          <div className="rounded-xl border bg-card overflow-hidden divide-y divide-border">
            {group.items.map((item) => {
              const config = STATUS_CONFIG[item.status];
              const StatusIcon = config.icon;
              const contactName =
                item.bill?.contact?.name ||
                item.contact?.name ||
                t("unknown");

              return (
                <div
                  key={item.id}
                  className="flex items-center gap-3 px-4 py-3"
                >
                  <div
                    className={cn(
                      "flex size-9 shrink-0 items-center justify-center rounded-lg",
                      item.status === "pending"
                        ? "bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400"
                        : item.status === "completed"
                          ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"
                          : item.status === "failed"
                            ? "bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400"
                            : "bg-muted text-muted-foreground"
                    )}
                  >
                    <StatusIcon className="size-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">
                        {contactName}
                      </p>
                      <Badge variant={config.variant} className="text-[10px]">
                        {bankPaymentStatus(t, item.status)}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                      {item.bill && (
                        <span className="font-mono">
                          {item.bill.billNumber}
                        </span>
                      )}
                      {item.bill && (
                        <span className="text-border">{"\u00B7"}</span>
                      )}
                      <span>
                        {new Date(
                          item.scheduledDate + "T00:00:00"
                        ).toLocaleDateString()}
                      </span>
                      {item.notes && (
                        <>
                          <span className="text-border">{"\u00B7"}</span>
                          <span className="truncate">{item.notes}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <p className="font-mono text-sm font-semibold tabular-nums break-all">
                      {formatMoney(item.amount, item.currencyCode, unitPresentation)}
                    </p>
                    {item.status === "pending" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-muted-foreground"
                        onClick={() => handleCancel(item.id)}
                      >{t("cancel")}</Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Schedule Payment Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("schedulePayment")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-xs">{t("bill")}</Label>
              <Select
                value={selectedBillId}
                onValueChange={(val) => {
                  setSelectedBillId(val);
                  const b = bills.find((x) => x.id === val);
                  if (b) setAmount(paymentUiDecimal(b.amountDue, b.currencyCode));
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("selectBill")} />
                </SelectTrigger>
                <SelectContent>
                  {bills.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.billNumber} - {b.contact?.name || t("unknown")} (
                      {t("amountDue", { amount: formatMoney(b.amountDue, b.currencyCode, unitPresentation) })})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">{t("amount")}</Label>
              <Input
                type="text"
                inputMode="decimal"
                aria-label={t("paymentAmount", { currency: currencyLabel(selectedBill?.currencyCode || t("selectBill"), unitPresentation.locale) })}
                aria-invalid={!!amount && !preview}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <PaymentAmountPreview text={amount} bill={selectedBill} />
            <div className="space-y-2">
              <Label className="text-xs">{t("scheduledDate")}</Label>
              <Input
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">{t("notesOptional")}</Label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t("notePlaceholder")}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDialog(false)}
            >{t("cancel")}</Button>
            <Button
              onClick={handleSchedule}
              disabled={saving || !selectedBill || !scheduledDate || !preview}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
              {t("schedule")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ContentReveal>
  );
}
