"use client";
import { BidiText, IdentifierText } from "@/components/ui/bidi-text";

import { usePresentation } from "@/i18n/provider";
import { useTranslations } from "next-intl";
import { bankPaymentStatus, paymentFailure, requirePaymentResponse } from "@/i18n/bank-payment-presentation";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  FileStack,
  Trash2,
  Mail,
  Send,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ContentReveal } from "@/components/ui/content-reveal";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BrandLoader } from "@/components/dashboard/brand-loader";
import { useConfirm } from "@/lib/hooks/use-confirm";
import { paymentUiMoney as formatMoney, paymentUiBatch, paymentUiRemittance } from "@/lib/money/payment-ui";
import { cn } from "@/lib/utils";
import { useDocumentTitle } from "@/lib/hooks/use-document-title";

interface BatchItemDetail {
  id: string;
  billId: string | null;
  contactId: string | null;
  amount: bigint;
  currencyCode: string;
  status: "pending" | "processing" | "completed" | "failed" | "cancelled";
  bill: {
    id: string;
    billNumber: string;
    total: bigint;
    amountDue: bigint;
    contact: { id: string; name: string } | null;
  } | null;
  contact: { id: string; name: string } | null;
}

interface RemittanceLine {
  billId: string;
  billNumber: string;
  billDate: string;
  billReference: string | null;
  billTotal: bigint;
  amountPaid: bigint;
  currencyCode: string;
}

interface RemittanceGroup {
  contactId: string;
  contactName: string;
  contactEmail: string | null;
  currencyCode: string;
  totalPaid: bigint;
  lines: RemittanceLine[];
}

interface BatchDetail {
  id: string;
  name: string;
  status: "draft" | "submitted" | "completed";
  totalAmount: bigint;
  currencyCode: string;
  paymentCount: number;
  submittedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  items: BatchItemDetail[];
}

const ITEM_STATUS_CONFIG: Record<
  string,
  { variant: "default" | "secondary" | "outline" | "destructive" }
> = {
  pending: { variant: "secondary" },
  processing: { variant: "default" },
  completed: { variant: "outline" },
  failed: { variant: "destructive" },
  cancelled: { variant: "outline" },
};

export default function BatchDetailPage() {
  const { id } = useParams<{ id: string }>();
  const orgId = typeof window !== "undefined" ? localStorage.getItem("activeOrgId") : null;
  return <BatchDetails key={`${orgId}:${id}`} id={id} orgId={orgId} />;
}
function BatchDetails({ id, orgId }: { id: string; orgId: string | null }) {
  const unitPresentation = usePresentation();
  const t = useTranslations("BankPayments");
  const errors = useTranslations("BankAccountErrors");
  const router = useRouter();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const [batch, setBatch] = useState<BatchDetail | null>(null);
  const [readError, setReadError] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [remittanceOpen, setRemittanceOpen] = useState(false);
  const [remittanceLoading, setRemittanceLoading] = useState(false);
  const [remittanceGroups, setRemittanceGroups] = useState<RemittanceGroup[] | null>(null);
  const [sending, setSending] = useState(false);
  useDocumentTitle(t("detailsTitle"));

  const fetchBatch = useCallback((signal?: AbortSignal) => {
    if (!orgId || !id) return;
    fetch(`/api/v1/payment-batches/${id}`, {
      headers: { "x-organization-id": orgId }, signal,
    })
      .then((res) => { if (!res.ok) throw new Error("Unable to load batch"); return res.json(); })
      .then((data) => { const saved = data.batch ? paymentUiBatch(data.batch) as unknown as BatchDetail : null; if (!signal?.aborted) { setBatch(saved); setReadError(""); } })
      .catch(() => { if (!signal?.aborted) { setBatch(null); setReadError(t("batchesUnavailable")); } })
      .finally(() => { if (!signal?.aborted) setLoading(false); });
  }, [orgId, id, t]);

  useEffect(() => {
    const controller = new AbortController();
    fetchBatch(controller.signal);
    return () => controller.abort();
  }, [fetchBatch]);

  async function handleSubmit() {
    if (!orgId || !batch) return;

    const confirmed = await confirm({
      title: t("submitTitle"),
      description: t("submitConfirm", { count: batch.paymentCount, amount: formatMoney(batch.totalAmount, batch.currencyCode, unitPresentation) }),
      confirmLabel: t("submitBatch"),
      destructive: false,
    });

    if (!confirmed || localStorage.getItem("activeOrgId") !== orgId) return;
    setSubmitting(true);

    try {
      const res = await fetch(
        `/api/v1/payment-batches/${batch.id}/submit`,
        {
          method: "POST",
          headers: { "x-organization-id": orgId },
        }
      );
      await requirePaymentResponse(res, t, errors, t("submitFailed"));
      const data = await res.json();

      toast.success(
        t("batchSubmitted", { processed: data.processed, total: data.total })
      );
      fetchBatch();
    } catch (error) {
      toast.error(paymentFailure(error, t, t("submitFailed")));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleOpenRemittance() {
    if (!orgId || !batch) return;
    setRemittanceOpen(true);
    setRemittanceLoading(true);
    setRemittanceGroups(null);
    try {
      const res = await fetch(
        `/api/v1/payment-batches/${batch.id}/remittance`,
        {
          headers: { "x-organization-id": orgId },
        }
      );
      await requirePaymentResponse(res, t, errors, t("loadRemittanceFailed"));
      const data = await res.json();
      setRemittanceGroups((data.remittances || []).map(paymentUiRemittance) as RemittanceGroup[]);
    } catch (error) {
      toast.error(paymentFailure(error, t, t("loadRemittanceFailed")));
      setRemittanceOpen(false);
    } finally {
      setRemittanceLoading(false);
    }
  }

  async function handleSendRemittance() {
    if (!orgId || !batch) return;
    setSending(true);
    try {
      const res = await fetch(
        `/api/v1/payment-batches/${batch.id}/remittance`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-organization-id": orgId,
          },
          body: JSON.stringify({}),
        }
      );
      await requirePaymentResponse(res, t, errors, t("emailRemittanceFailed"));
      const data = await res.json();
      const sentCount = data.sent?.length ?? 0;
      const skippedCount = data.skipped?.length ?? 0;
      if (sentCount === 0) {
        toast.warning(
          skippedCount > 0
            ? t("noEmailSent")
            : t("noSuppliers")
        );
      } else {
        toast.success(
          skippedCount > 0 ? t("emailedSkipped", { count: sentCount, skipped: skippedCount }) : t("emailed", { count: sentCount })
        );
      }
      setRemittanceOpen(false);
    } catch (error) {
      toast.error(paymentFailure(error, t, t("emailRemittanceFailed")));
    } finally {
      setSending(false);
    }
  }

  async function handleRemoveItem(itemId: string) {
    if (!orgId || !batch) return;

    try {
      const res = await fetch(`/api/v1/payment-batches/${batch.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-organization-id": orgId,
        },
        body: JSON.stringify({ removeItemIds: [itemId] }),
      });

      if (!res.ok) {
        await requirePaymentResponse(res, t, errors, t("removeFailed"));
        return;
      }

      toast.success(t("itemRemoved"));
      fetchBatch();
    } catch (error) {
      toast.error(paymentFailure(error, t, t("removeFailed")));
    }
  }

  if (readError) return <p role="alert">{readError}</p>;
  if (loading) return <BrandLoader />;

  if (!batch) {
    return (
      <ContentReveal className="py-16 text-center">
        <p className="text-sm text-muted-foreground">{t("notFound")}</p>
        <Button variant="outline" size="sm" onClick={() => router.push("/accounting/banking/batches")} className="h-auto min-h-8 min-w-0 whitespace-normal mt-4">{t("backBatches")}</Button>
      </ContentReveal>
    );
  }

  const completedCount = batch.items.filter(
    (i) => i.status === "completed"
  ).length;
  const failedCount = batch.items.filter(
    (i) => i.status === "failed"
  ).length;

  return (
    <ContentReveal className="space-y-6">
      {confirmDialog}

      {/* Back nav */}
      <button
        type="button"
        onClick={() => router.push("/accounting/banking/batches")}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="[&:dir(rtl)]:rotate-180 size-3.5" />{t("backBatches")}</button>

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
            <FileStack className="size-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-semibold"><BidiText>{batch.name}</BidiText></h2>
              <Badge
                variant={
                  batch.status === "draft"
                    ? "secondary"
                    : batch.status === "submitted"
                      ? "default"
                      : "outline"
                }
                className="text-[10px] capitalize"
              >
                {bankPaymentStatus(t, batch.status)}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t("createdDate", { date: new Date(batch.createdAt).toLocaleDateString() })}
              {batch.completedAt && (
                <>
                  {" "}
                  {"\u00B7"} {t("completedDate", { date: new Date(batch.completedAt).toLocaleDateString() })}
                </>
              )}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {batch.status !== "draft" && (
            <Button size="sm" variant="outline" onClick={handleOpenRemittance} className="h-auto min-h-8 min-w-0 whitespace-normal">
              <Mail className="me-2 size-4" />{t("viewRemittance")}</Button>
          )}
          {batch.status === "draft" && (
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={submitting || batch.items.length === 0}
              className="h-auto min-h-8 min-w-0 whitespace-normal bg-emerald-600 hover:bg-emerald-700"
            >
              {submitting ? (
                <Loader2 className="me-2 size-4 animate-spin" />
              ) : (
                <CheckCircle2 className="me-2 size-4" />
              )}
              {t("submitBatch")}
            </Button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-lg border p-3">
          <p className="text-[11px] text-muted-foreground">{t("totalAmount")}</p>
          <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums break-all">
            <BidiText>{formatMoney(batch.totalAmount, batch.currencyCode, unitPresentation)}</BidiText>
          </p>
        </div>
        <div className="rounded-lg border p-3">
          <p className="text-[11px] text-muted-foreground">{t("payments")}</p>
          <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums break-all">
            {batch.paymentCount}
          </p>
        </div>
        {batch.status !== "draft" && (
          <>
            <div className="rounded-lg border p-3">
              <p className="text-[11px] text-muted-foreground">{t("completed")}</p>
              <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums break-all text-emerald-600 dark:text-emerald-400">
                {completedCount}
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-[11px] text-muted-foreground">{t("failed")}</p>
              <p
                className={cn(
                  "mt-0.5 font-mono text-sm font-semibold tabular-nums break-all",
                  failedCount > 0
                    ? "text-red-600 dark:text-red-400"
                    : "text-muted-foreground"
                )}
              >
                {failedCount}
              </p>
            </div>
          </>
        )}
      </div>

      {/* Items */}
      <div>
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
          {t("items", { count: batch.items.length })}
        </p>
        <div className="rounded-xl border bg-card overflow-hidden divide-y divide-border">
          {batch.items.length === 0 && (
            <p className="text-xs text-muted-foreground p-4 text-center">{t("noItems")}</p>
          )}
          {batch.items.map((item) => {
            const statusConfig =
              ITEM_STATUS_CONFIG[item.status] || ITEM_STATUS_CONFIG.pending;
            const contactName =
              item.bill?.contact?.name ||
              item.contact?.name ||
              t("unknown");

            return (
              <div
                key={item.id}
                className="flex flex-wrap items-center gap-3 px-4 py-3"
              >
                <div className="min-w-0 flex-1 basis-40">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium min-w-0 whitespace-normal [overflow-wrap:anywhere]">
                      <BidiText>{contactName}</BidiText>
                    </p>
                    {batch.status !== "draft" && (
                      <Badge
                        variant={statusConfig.variant}
                        className="text-[10px]"
                      >
                        {bankPaymentStatus(t, item.status)}
                      </Badge>
                    )}
                  </div>
                  {item.bill && (
                    <p className="text-xs text-muted-foreground mt-0.5 font-mono">
                      <IdentifierText>{item.bill.billNumber}</IdentifierText>
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-3 shrink-0">
                  <p className="font-mono text-sm font-semibold tabular-nums break-all">
                    <BidiText>{formatMoney(item.amount, item.currencyCode, unitPresentation)}</BidiText>
                  </p>
                  {batch.status === "draft" && (
                    <Button variant="ghost" size="sm" aria-label={t("removeItem")} onClick={() => handleRemoveItem(item.id)} className="h-auto min-h-8 min-w-0 whitespace-normal w-7 p-0 text-muted-foreground hover:text-red-600">
                      <Trash2 className="size-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Remittance advice */}
      <Dialog open={remittanceOpen} onOpenChange={setRemittanceOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("remittance")}</DialogTitle>
            <DialogDescription>{t("remittanceHint")}</DialogDescription>
          </DialogHeader>

          {remittanceLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : remittanceGroups && remittanceGroups.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{t("noRemittanceSuppliers")}</p>
          ) : (
            <div className="space-y-4">
              {remittanceGroups?.map((group) => (
                <div
                  key={group.contactId}
                  className="rounded-lg border bg-card overflow-hidden"
                >
                  <div className="flex items-center justify-between gap-2 border-b bg-muted/40 px-4 py-2.5">
                    <div className="min-w-0">
                      <p className="text-sm font-medium min-w-0 whitespace-normal [overflow-wrap:anywhere]">
                        <BidiText>{group.contactName}</BidiText>
                      </p>
                      {group.contactEmail ? (
                        <p className="text-xs text-muted-foreground min-w-0 whitespace-normal [overflow-wrap:anywhere]">
                          <IdentifierText>{group.contactEmail}</IdentifierText>
                        </p>
                      ) : (
                        <p className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                          <AlertCircle className="size-3" />{t("noEmail")}</p>
                      )}
                    </div>
                    <p className="font-mono text-sm font-semibold tabular-nums break-all shrink-0">
                      <BidiText>{formatMoney(group.totalPaid, group.currencyCode, unitPresentation)}</BidiText>
                    </p>
                  </div>
                  <div className="divide-y divide-border">
                    {group.lines.map((line) => (
                      <div
                        key={line.billId}
                        className="flex items-center justify-between gap-2 px-4 py-2"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-mono min-w-0 whitespace-normal [overflow-wrap:anywhere]">
                            <IdentifierText>{line.billNumber}</IdentifierText>
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {new Date(
                              line.billDate + "T00:00:00"
                            ).toLocaleDateString()}
                            <BidiText>{line.billReference
                              ? ` · ${line.billReference}`
                              : ""}</BidiText>
                          </p>
                        </div>
                        <p className="font-mono text-xs tabular-nums break-all">
                          <BidiText>{formatMoney(line.amountPaid, line.currencyCode, unitPresentation)}</BidiText>
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setRemittanceOpen(false)} disabled={sending} className="h-auto min-h-8 min-w-0 whitespace-normal">{t("close")}</Button>
            <Button size="sm" onClick={handleSendRemittance} disabled={
                sending ||
                remittanceLoading ||
                !remittanceGroups ||
                !remittanceGroups.some((g) => g.contactEmail)
              } className="h-auto min-h-8 min-w-0 whitespace-normal">
              {sending ? (
                <Loader2 className="me-2 size-4 animate-spin" />
              ) : (
                <Send className="me-2 size-4" />
              )}
              {t("emailSuppliers")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ContentReveal>
  );
}
