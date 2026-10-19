"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { billStatusLabel } from "@/i18n/bill-presentation";
import { toast } from "sonner";
import { ArrowLeft, Check, DollarSign, Ban, Undo2, ThumbsUp, X, GitCompareArrows, FileBarChart, PackageCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InvoiceAmountInput } from "@/components/dashboard/invoice-amount-input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { BrandLoader } from "@/components/dashboard/brand-loader";
import { ContentReveal } from "@/components/ui/content-reveal";
import { useConfirm } from "@/lib/hooks/use-confirm";
import { useDocumentTitle } from "@/lib/hooks/use-document-title";
import { useEntityTitle } from "@/lib/hooks/use-entity-title";
import { billUiMoney as formatMoney, billUiDecimal as minorUnitsToDecimal, billUiDocument,
  billUiBase, billUiAmountValid, billUiPaymentAmount, billUiPaymentValid, billUiPercent, billUiSupplierCreditLines } from "@/lib/money/bill-ui";
import { DualAmount } from "@/components/ui/dual-amount";
import { RateNote, type RateInfo } from "@/components/ui/rate-note";
import { ReceiptAttachments } from "@/components/dashboard/receipt-attachments";
import Link from "next/link";

interface BillDetail {
  id: string; billNumber: string; issueDate: string; dueDate: string; status: string;
  subtotal: bigint; taxTotal: bigint; total: bigint; amountPaid: bigint; amountDue: bigint;
  currencyCode: string;
  contactId: string;
  notes: string | null; contact: { name: string } | null;
  rejectionReason: string | null;
  lines: { id: string; description: string; quantity: number; unitPrice: bigint; amount: bigint; taxAmount: bigint;
    accountId?: string | null; taxRateId?: string | null; costCenterId?: string | null; discountPercent?: number;
    taxRate?: { id: string } | null; goodsReceiptLineId: string | null; account: { id: string; code: string; name: string } | null }[];
}

interface BaseAmounts {
  baseCurrency: string;
  rate: number | null;
  amounts: {
    total: bigint | null;
    amountDue: bigint | null;
    amountPaid: bigint | null;
    subtotal: bigint | null;
    taxTotal: bigint | null;
  };
  status?: RateInfo;
}

const statusConfig: Record<string, { class: string }> = {
  draft: { class: "" },
  pending_approval: { class: "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-950 dark:text-violet-300" },
  received: { class: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300" },
  partial: { class: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300" },
  paid: { class: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" },
  overdue: { class: "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300" },
  void: { class: "border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-300" },
};

// Plain-language status labels (end users aren't accountants).
// "received" here means the bill has been approved and added to your books.
export default function BillDetailPage() {
  const t = useTranslations("SupplierBills");
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const [b, setB] = useState<BillDetail | null>(null);
  const [base, setBase] = useState<BaseAmounts | null>(null);
  const [loading, setLoading] = useState(true);
  const [moneyError, setMoneyError] = useState("");
  const [loadedContext, setLoadedContext] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [payAmount, setPayAmount] = useState("");
  const [payDate, setPayDate] = useState(new Date().toISOString().split("T")[0]);
  const [payOpen, setPayOpen] = useState(false);
  const [paying, setPaying] = useState(false);
  const [creditingSupplier, setCreditingSupplier] = useState(false);
  const [approving, setApproving] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const orgId = typeof window !== "undefined" ? localStorage.getItem("activeOrgId") : null;

  useDocumentTitle(t("detailDocumentTitle"));
  useEntityTitle(b?.billNumber);

  const context = `${orgId}:${id}`;
  const loadBill = useCallback(() => setRefresh(value => value + 1), []);

  useEffect(() => {
    if (!orgId) return;
    const controller = new AbortController();
    setLoading(true); setB(null); setBase(null); setMoneyError("");
    setPayOpen(false); setPayAmount("");
    fetch(`/api/v1/bills/${id}`, { headers: { "x-organization-id": orgId }, signal: controller.signal })
      .then(async response => {
        if (response.status === 404) return { bill: null, base: null };
        if (!response.ok) throw new Error("Bill read failed");
        return response.json();
      })
      .then(data => {
        if (data.bill === null) return;
        const document = billUiDocument(data.bill) as BillDetail;
        const converted = data.base ? billUiBase(data.base) as BaseAmounts : null;
        if (!controller.signal.aborted) { setB(document); setBase(converted); }
      })
      .catch(() => { if (!controller.signal.aborted) setMoneyError(t("detailFailed")); })
      .finally(() => { if (!controller.signal.aborted) { setLoadedContext(context); setLoading(false); } });
    return () => controller.abort();
  }, [id, orgId, refresh, context, t]);

  async function handleReceive() {
    if (!orgId || !b || loadedContext !== context) return;
    try {
      const res = await fetch(`/api/v1/bills/${id}/receive`, { method: "POST", headers: { "x-organization-id": orgId } });
      if (res.ok) { loadBill(); toast.success(t("receivedSuccess")); }
      else toast.error(t("receiveFailed"));
    } catch { toast.error(t("receiveFailed")); }
  }

  // Approve a bill that's waiting for approval. This posts it to your books
  // (same end state as "Add to my books") and stamps who approved it.
  async function handleApprove() {
    if (!orgId) return;
    setApproving(true);
    try {
      const res = await fetch(`/api/v1/bills/${id}/approve`, { method: "POST", headers: { "x-organization-id": orgId } });
      if (res.ok) {
        toast.success(t("approvedSuccess"));
        loadBill();
      } else {
        toast.error(t("approveFailed"));
      }
    } catch { toast.error(t("approveFailed")); } finally {
      setApproving(false);
    }
  }

  // Reject a bill that's waiting for approval. Sends it back to draft with the
  // reason recorded, so it can be fixed and re-submitted.
  async function handleReject() {
    if (!orgId) return;
    setRejecting(true);
    try {
      const res = await fetch(`/api/v1/bills/${id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-organization-id": orgId },
        body: JSON.stringify({ reason: rejectReason.trim() || undefined }),
      });
      if (res.ok) {
        setRejectOpen(false);
        setRejectReason("");
        toast.success(t("rejectedSuccess"));
        loadBill();
      } else {
        toast.error(t("rejectFailed"));
      }
    } catch { toast.error(t("rejectFailed")); } finally {
      setRejecting(false);
    }
  }

  async function handlePay() {
    if (!orgId || !b || loadedContext !== context || paying) return;
    let amount: { amountMinor: string };
    try {
      amount = billUiPaymentAmount(payAmount, b.currencyCode, b.amountDue);
    } catch { toast.error(t("invalidPayment")); return; }
    setPaying(true);
    try {
      const res = await fetch(`/api/v1/bills/${id}/pay`, {
        method: "POST", headers: { "Content-Type": "application/json", "x-organization-id": orgId },
        body: JSON.stringify({ ...amount, date: payDate }),
      });
      if (res.ok) { loadBill(); setPayOpen(false); toast.success(t("paymentSuccess")); }
      else { toast.error(t("paymentFailed")); }
    } catch { toast.error(t("paymentRetry")); }
    finally { setPaying(false); }
  }

  async function handleVoid() {
    if (!orgId) return;
    const confirmed = await confirm({
      title: t("cancelTitle"),
      description: t("cancelDescription"),
      confirmLabel: t("cancelBill"),
      destructive: true,
    });
    if (!confirmed) return;
    try {
      const res = await fetch(`/api/v1/bills/${id}/void`, { method: "POST", headers: { "x-organization-id": orgId } });
      if (res.ok) { loadBill(); toast.success(t("cancelledSuccess")); }
      else toast.error(t("cancelFailed"));
    } catch { toast.error(t("cancelFailed")); }
  }

  // Record a supplier credit (a "debit note") — money the supplier owes you back,
  // e.g. for returned goods or an overcharge. Starts a credit pre-filled from
  // this bill's lines so you don't have to retype them.
  async function handleSupplierCredit() {
    if (!orgId || !b) return;
    const confirmed = await confirm({
      title: t("creditTitle"),
      description:
        t("creditDescription"),
      confirmLabel: t("startCredit"),
    });
    if (!confirmed) return;
    setCreditingSupplier(true);
    try {
      const res = await fetch(`/api/v1/debit-notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-organization-id": orgId },
        body: JSON.stringify({
          contactId: b.contactId,
          billId: b.id,
          issueDate: new Date().toISOString().split("T")[0],
          currencyCode: b.currencyCode,
          reference: b.billNumber,
          lines: billUiSupplierCreditLines(b.lines, b.currencyCode),
        }),
      });
      if (res.ok) {
        toast.success(t("creditSuccess"));
        router.push("/purchases");
      } else {
        toast.error(t("creditFailed"));
      }
    } catch { toast.error(t("creditFailed")); } finally {
      setCreditingSupplier(false);
    }
  }

  if (loading || (orgId && loadedContext !== context)) return <BrandLoader />;

  if (moneyError) return <div role="alert" className="text-sm text-destructive">{moneyError}</div>;

  if (!b) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <p className="text-sm text-muted-foreground">{t("notFound")}</p>
        <Button variant="ghost" size="sm" asChild className="mt-2">
          <Link href="/purchases">{t("back")}</Link>
        </Button>
      </div>
    );
  }

  const sc = statusConfig[b.status] || statusConfig.draft;

  return (
    <ContentReveal>
      <div className="space-y-6">
        {/* Top bar */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild className="size-8 p-0">
              <Link href="/purchases"><ArrowLeft className="size-4" /></Link>
            </Button>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-lg font-semibold tracking-tight">{b.billNumber}</h1>
                <Badge variant="outline" className={sc.class}>{billStatusLabel(b.status, t)}</Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">
                {t("supplierDue", { name: b.contact?.name || t("unknownSupplier"), date: b.dueDate })}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              asChild
              title={t("statementHint")}
            >
              <Link href={`/contacts/${b.contactId}/statement`}>
                <FileBarChart className="mr-2 size-3.5" />{t("statement")}
              </Link>
            </Button>
            {b.status === "pending_approval" && (
              <>
                <Button
                  size="sm"
                  onClick={handleApprove}
                  loading={approving}
                  className="bg-emerald-600 hover:bg-emerald-700"
                  title={t("approveHint")}
                >
                  <ThumbsUp className="mr-2 size-3.5" />{t("approve")}
                </Button>
                <Dialog open={rejectOpen} onOpenChange={(o) => { setRejectOpen(o); if (!o) setRejectReason(""); }}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700" title={t("rejectHint")}>
                      <X className="mr-2 size-3.5" />{t("reject")}
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>{t("rejectTitle")}</DialogTitle></DialogHeader>
                    <div className="space-y-4">
                      <p className="text-sm text-muted-foreground">
                        {t("rejectDescription")}
                      </p>
                      <div className="space-y-2">
                        <Label>{t("reason")}</Label>
                        <Input
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          placeholder={t("reasonPlaceholder")}
                        />
                      </div>
                      <Button onClick={handleReject} loading={rejecting} className="w-full bg-red-600 hover:bg-red-700">
                        {t("rejectBill")}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </>
            )}
            {b.status === "draft" && (
              <Button size="sm" onClick={handleReceive} className="bg-emerald-600 hover:bg-emerald-700" title={t("approveHint")}>
                <Check className="mr-2 size-3.5" />{t("addToBooks")}
              </Button>
            )}
            {["received", "partial", "overdue"].includes(b.status) && (
              <Dialog open={payOpen} onOpenChange={setPayOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700">
                    <DollarSign className="mr-2 size-3.5" />{t("recordPayment")}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>{t("recordPayment")}</DialogTitle></DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>{t("amount")}</Label>
                      <InvoiceAmountInput currency={b.currencyCode} value={payAmount} onChange={setPayAmount} placeholder={minorUnitsToDecimal(b.amountDue, b.currencyCode)} />
                      {billUiAmountValid(payAmount, b.currencyCode) && !billUiPaymentValid(payAmount, b.currencyCode, b.amountDue) &&
                        <p role="alert" className="text-xs text-destructive">{t("paymentTooHigh")}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label>{t("date")}</Label>
                      <Input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
                    </div>
                    <Button onClick={handlePay} loading={paying} disabled={paying || !billUiPaymentValid(payAmount, b.currencyCode, b.amountDue)} className="w-full bg-emerald-600 hover:bg-emerald-700">{t("recordPayment")}</Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
            {["received", "partial", "paid", "overdue"].includes(b.status) && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleSupplierCredit}
                loading={creditingSupplier}
                title={t("creditHint")}
              >
                <Undo2 className="mr-2 size-3.5" />{t("recordCredit")}
              </Button>
            )}
            {b.status !== "void" && b.status !== "paid" && (
              <Button variant="outline" size="sm" onClick={handleVoid} className="text-red-600 hover:text-red-700" title={t("cancelHint")}>
                <Ban className="mr-2 size-3.5" />{t("cancelBill")}
              </Button>
            )}
          </div>
        </div>

        {/* Gradient divider */}
        <div className="h-px bg-gradient-to-r from-blue-500/20 via-border to-transparent" />

        {/* Bill document */}
        <div className="rounded-xl border bg-card overflow-hidden">
          {/* Document header */}
          <div className="border-b bg-muted/30 px-4 py-4 sm:px-6 sm:py-5">
            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">{t("from")}</p>
                <p className="text-sm font-semibold">{b.contact?.name || t("unknownSupplier")}</p>
              </div>
              <div className="sm:text-right">
                <div className="space-y-1.5">
                  <div className="flex sm:justify-end items-center gap-3">
                    <span className="text-xs text-muted-foreground">{t("bill")}</span>
                    <span className="text-sm font-mono font-semibold">{b.billNumber}</span>
                  </div>
                  <div className="flex sm:justify-end items-center gap-3">
                    <span className="text-xs text-muted-foreground">{t("issued")}</span>
                    <span className="text-sm">{b.issueDate}</span>
                  </div>
                  <div className="flex sm:justify-end items-center gap-3">
                    <span className="text-xs text-muted-foreground">{t("due")}</span>
                    <span className="text-sm">{b.dueDate}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Line items */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[500px] text-sm">
              <thead>
                <tr className="border-b bg-muted/20">
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground sm:px-6">{t("lineDescription")}</th>
                  <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground w-20">{t("quantity")}</th>
                  <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground w-28">{t("price")}</th>
                  <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground w-28 sm:pr-6">{t("amount")}</th>
                </tr>
              </thead>
              <tbody>
                {b.lines.map((line, i) => (
                  <tr key={line.id} className={i < b.lines.length - 1 ? "border-b border-dashed" : ""}>
                    <td className="px-4 py-3 sm:px-6">
                      <p>{line.description}</p>
                      {line.account && (
                        <p className="text-xs text-muted-foreground mt-0.5">{line.account.code} · {line.account.name}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">{line.quantity / 100}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-muted-foreground">{formatMoney(line.unitPrice, b.currencyCode)}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums font-medium sm:pr-6">{formatMoney(line.amount, b.currencyCode)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="border-t bg-muted/10 px-4 py-3 sm:px-6 sm:py-4">
            <div className="flex justify-end">
              <div className="w-full max-w-xs space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t("subtotal")}</span>
                  <span className="font-mono tabular-nums">{formatMoney(b.subtotal, b.currencyCode)}</span>
                </div>
                {b.taxTotal > 0n && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t("tax")}</span>
                    <span className="font-mono tabular-nums">{formatMoney(b.taxTotal, b.currencyCode)}</span>
                  </div>
                )}
                <div className="h-px bg-border my-1" />
                <div className="flex justify-between text-sm font-semibold">
                  <span>{t("total")}</span>
                  <span className="font-mono tabular-nums">{formatMoney(b.total, b.currencyCode)}</span>
                </div>
                {base && base.baseCurrency !== b.currencyCode && (
                  <>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{t("inCurrency", { currency: base.baseCurrency })}</span>
                      <span className="font-mono tabular-nums">
                        {base.amounts.total == null
                          ? "—"
                          : `≈ ${formatMoney(base.amounts.total, base.baseCurrency)}`}
                      </span>
                    </div>
                    <RateNote
                      currency={b.currencyCode}
                      baseCurrency={base.baseCurrency}
                      status={base.status}
                    />
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Payment summary + Notes */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border bg-card p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("paymentStatus")}</p>
              <span className="text-xs font-mono text-muted-foreground">{billUiPercent(b.amountPaid, b.total)}%</span>
            </div>
            <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden mb-4">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all"
                style={{ width: `${billUiPercent(b.amountPaid, b.total)}%` }}
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <p className="text-[11px] text-muted-foreground">{t("total")}</p>
                <div className="text-sm font-mono font-semibold mt-0.5">
                  <DualAmount
                    amount={b.total}
                    currency={b.currencyCode}
                    baseCurrency={base?.baseCurrency}
                    baseAmount={base?.amounts.total ?? null}
                  />
                </div>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">{t("paid")}</p>
                <p className="text-sm font-mono font-semibold tabular-nums text-emerald-600 mt-0.5">{formatMoney(b.amountPaid, b.currencyCode)}</p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">{t("due")}</p>
                <div className="text-sm font-mono font-semibold text-amber-600 mt-0.5">
                  <DualAmount
                    amount={b.amountDue}
                    currency={b.currencyCode}
                    baseCurrency={base?.baseCurrency}
                    baseAmount={base?.amounts.amountDue ?? null}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border bg-card p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">{t("details")}</p>
            <div className="space-y-3">
              <div>
                <p className="text-[11px] text-muted-foreground">{t("issued")}</p>
                <p className="text-sm mt-0.5">{b.issueDate}</p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">{t("due")}</p>
                <p className="text-sm mt-0.5">{b.dueDate}</p>
              </div>
              {b.rejectionReason && (
                <div>
                  <p className="text-[11px] text-muted-foreground">{t("lastRejection")}</p>
                  <p className="text-sm mt-0.5 whitespace-pre-wrap text-red-600">{b.rejectionReason}</p>
                </div>
              )}
              {b.notes ? (
                <div>
                  <p className="text-[11px] text-muted-foreground">{t("notes")}</p>
                  <p className="text-sm mt-0.5 whitespace-pre-wrap">{b.notes}</p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">{t("noNotes")}</p>
              )}
            </div>
          </div>
        </div>

        {/* Order match — which bill lines are tied back to a goods receipt
            (what actually arrived). This is the audit trail that the bill
            matches the order/delivery. */}
        {b.lines.some((l) => l.goodsReceiptLineId) ? (
          <div className="rounded-xl border bg-card p-5">
            <div className="flex items-center gap-2 mb-1">
              <GitCompareArrows className="size-4 text-muted-foreground" />
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("orderMatch")}</p>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              {t("orderMatchHint")}
            </p>
            <div className="space-y-1.5">
              {b.lines.map((line) => (
                <div
                  key={line.id}
                  className="flex items-center justify-between gap-3 rounded-md border bg-muted/20 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="text-sm truncate">{line.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {line.quantity / 100} × {formatMoney(line.unitPrice, b.currencyCode)}
                    </p>
                  </div>
                  {line.goodsReceiptLineId ? (
                    <Badge variant="outline" className="shrink-0 border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                      <PackageCheck className="mr-1 size-3" />{t("matched")}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="shrink-0 text-muted-foreground">
                      {t("notOnOrder")}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* Supplier document trail — attach the supplier's PDF/receipt to this bill. */}
        <div className="rounded-xl border bg-card p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">{t("supplierDocuments")}</p>
          <ReceiptAttachments
            orgId={orgId}
            entityType="bill"
            entityId={b.id}
            label={t("attachLabel")}
          />
        </div>
      </div>
      {confirmDialog}
    </ContentReveal>
  );
}
