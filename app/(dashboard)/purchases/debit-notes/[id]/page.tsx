"use client";

import { usePresentation } from "@/i18n/provider";
import { currencyLabel } from "@/i18n/currency-labels";
import { useTranslations } from "next-intl";
import { debitNoteStatusLabel } from "@/i18n/debit-note-presentation";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Send, Ban, FileText } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InvoiceAmountInput } from "@/components/dashboard/invoice-amount-input";
import { DebitNoteMoneyDetails } from "@/components/dashboard/debit-note-money-details";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { debitNoteUiDocument, debitNoteUiBill, debitNoteUiBillEligible, debitNoteUiApplication, debitNoteUiMoney } from "@/lib/money/debit-note-ui";
import { invoiceUiDecimal } from "@/lib/money/invoice-ui";
import { useConfirm } from "@/lib/hooks/use-confirm";
import { useEntityTitle } from "@/lib/hooks/use-entity-title";
import { SendDocumentDialog } from "@/components/dashboard/send-document-dialog";
import { EmailHistory } from "@/components/dashboard/email-history";
import Link from "next/link";

interface DebitNoteDetail {
  currencyCode: string;
  id: string;
  debitNoteNumber: string;
  issueDate: string;
  status: string;
  reference: string | null;
  notes: string | null;
  subtotal: bigint;
  taxTotal: bigint;
  total: bigint;
  amountApplied: bigint;
  amountRemaining: bigint;
  contactId: string | null;
  billId: string | null;
  contact: { name: string; email: string | null } | null;
  lines: {
    id: string;
    description: string;
    quantity: number;
    unitPrice: bigint;
    amount: bigint;
    account: { code: string; name: string } | null;
    taxAmount: bigint;
  }[];
}

const statusColors: Record<string, string> = {
  draft: "",
  sent: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300",
  applied: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  void: "border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-300",
};

type DebitNoteWire = Omit<DebitNoteDetail, "subtotal" | "taxTotal" | "total" | "amountApplied" | "amountRemaining" | "lines"> & {
  subtotal: number; taxTotal: number; total: number; amountApplied: number; amountRemaining: number;
  lines: (Omit<DebitNoteDetail["lines"][number], "unitPrice" | "amount" | "taxAmount"> & { unitPrice: number; amount: number; taxAmount: number; [key: string]: unknown })[];
  [key: string]: unknown;
};
interface BillOption {
  id: string; billNumber: string; contactId: string | null; currencyCode: string; status: string;
  amountDue: bigint; contact: { name: string } | null;
}
type BillWire = Omit<BillOption, "amountDue"> & { amountDue: number; [key: string]: unknown };

export default function DebitNoteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const orgId = typeof window !== "undefined" ? localStorage.getItem("activeOrgId") : null;
  return <DebitNoteDetail key={`${orgId}:${id}`} id={id} orgId={orgId} />;
}

function DebitNoteDetail({ id, orgId }: { id: string; orgId: string | null }) {
  const unitPresentation = usePresentation();
  const t = useTranslations("DebitNotes");
  const { confirm, dialog: confirmDialog } = useConfirm();
  const [dn, setDn] = useState<DebitNoteDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [applyOpen, setApplyOpen] = useState(false);
  const [applyLoading, setApplyLoading] = useState(false);
  const [applyBillId, setApplyBillId] = useState("");
  const [applyAmount, setApplyAmount] = useState("");
  const [billLoaded, setBillLoaded] = useState<{ context: string; rows: BillOption[]; error: "billReadFailed" | null } | null>(null);
  const [error, setError] = useState<"detailReadFailed" | null>(null);
  const [reload, setReload] = useState(0);
  const active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);

  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [emailHistoryKey, setEmailHistoryKey] = useState(0);
  const [orgName, setOrgName] = useState("");

  useEntityTitle(dn?.debitNoteNumber);

  useEffect(() => {
    if (!orgId) return;
    const controller = new AbortController();
    fetch(`/api/v1/debit-notes/${id}`, { headers: { "x-organization-id": orgId }, signal: controller.signal })
      .then(r => { if (!r.ok) throw new Error("Unable to load supplier credit"); return r.json(); })
      .then(data => { const credit = debitNoteUiDocument(data.debitNote as DebitNoteWire); if (!controller.signal.aborted) { setDn(credit); setError(null); } })
      .catch(() => { if (!controller.signal.aborted) { setDn(null); setError("detailReadFailed"); } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    fetch("/api/v1/organization", { headers: { "x-organization-id": orgId }, signal: controller.signal })
      .then(r => r.json()).then(data => { if (!controller.signal.aborted && data.organization?.name) setOrgName(data.organization.name); }).catch(() => {});
    return () => controller.abort();
  }, [id, orgId, reload]);

  const billContext = `${dn?.contactId}:${dn?.currencyCode}:${dn?.amountRemaining}:${reload}`;
  const bills = billLoaded?.context === billContext ? billLoaded.rows : [];
  const billError = billLoaded?.context === billContext ? billLoaded.error : null;
  useEffect(() => {
    if (!orgId || !applyOpen || !dn?.contactId) return;
    const controller = new AbortController();
    const params = new URLSearchParams({ limit: "100" });
    fetch(`/api/v1/bills?${params}`, { headers: { "x-organization-id": orgId }, signal: controller.signal })
      .then(r => { if (!r.ok) throw new Error("Unable to load bills"); return r.json(); })
      .then(data => {
        if (!Array.isArray(data.data)) throw new Error("Unable to load bills");
        const rows = data.data.map((row: BillWire) => debitNoteUiBill(row)).filter((inv: BillOption) => debitNoteUiBillEligible(dn, inv));
        if (!controller.signal.aborted) setBillLoaded({ context: billContext, rows, error: null });
      })
      .catch(() => { if (!controller.signal.aborted) setBillLoaded({ context: billContext, rows: [], error: "billReadFailed" }); });
    return () => controller.abort();
  }, [orgId, applyOpen, dn, billContext]);

  function handleSendComplete() {
    if (!active.current) return;
    setSendDialogOpen(false);
    setDn(null); setLoading(true); setReload(k => k + 1);
    setEmailHistoryKey(k => k + 1);
  }

  let application: ReturnType<typeof debitNoteUiApplication> | null = null;
  let applicationError: string | null = null;
  const selectedBill = bills.find(inv => inv.id === applyBillId);
  if (dn && selectedBill && applyAmount !== "") {
    try { application = debitNoteUiApplication(applyAmount, dn, selectedBill); }
    catch { applicationError = t("invalidAmount"); }
  }

  async function handleApply() {
    if (!orgId || !dn || !selectedBill || applyLoading) return;
    setApplyLoading(true);
    try {
      const payload = debitNoteUiApplication(applyAmount, dn, selectedBill);
      const res = await fetch(`/api/v1/debit-notes/${id}/apply`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-organization-id": orgId,
        },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        if (!active.current) return;
        handleSendComplete();
        setApplyOpen(false);
        setApplyBillId("");
        setApplyAmount("");
        toast.success(t("applySuccess"));
      } else {
        if (active.current) toast.error(t("applyFailed"));
      }
    } catch {
      if (active.current) toast.error(t("applyFailed"));
    } finally {
      if (active.current) setApplyLoading(false);
    }
  }

  async function handleVoid() {
    if (!orgId) return;
    await confirm({
      title: t("voidTitle"),
      description: t("voidDescription"),
      confirmLabel: t("voidAction"),
      destructive: true,
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/v1/debit-notes/${id}/void`, {
            method: "POST",
            headers: { "x-organization-id": orgId },
          });
          if (res.ok) {
            if (!active.current) return;
            handleSendComplete();
            toast.success(t("voidSuccess"));
          } else if (active.current) {
            toast.error(t("voidFailed"));
          }
        } catch {
          if (active.current) toast.error(t("voidFailed"));
        }
      },
    });
  }

  if (loading) return <div className="space-y-6"><PageHeader title={t("loading")} /></div>;
  if (error) return <p role="alert" className="text-sm text-destructive">{t(error)}</p>;
  if (!dn) return <div className="space-y-6"><PageHeader title={t("notFound")} /></div>;

  return (
    <div className="space-y-6">
      <PageHeader title={dn.debitNoteNumber} description={t("sender", { name: dn.contact?.name || t("unknown") })}>
        <Button variant="outline" size="sm" asChild>
          <Link href="/purchases/debit-notes"><ArrowLeft className="mr-2 size-4" />{t("back")}</Link>
        </Button>
        {dn.status === "draft" && (
          <Button size="sm" onClick={() => setSendDialogOpen(true)} className="bg-emerald-600 hover:bg-emerald-700">
            <Send className="mr-2 size-4" />{t("send")}
          </Button>
        )}
        {dn.status === "sent" && dn.amountRemaining > 0n && (
          <Dialog open={applyOpen} onOpenChange={(open) => {
            setApplyOpen(open);
            if (open) { setBillLoaded(null); setApplyBillId(""); setApplyAmount(""); }
          }}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" title={t("applyHint")}>
                <FileText className="mr-2 size-4" />{t("applyAction")}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("applyTitle")}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>{t("bill")}</Label>
                  <p className="text-xs text-muted-foreground">{t("billScope")}</p>
                  <Select value={applyBillId} onValueChange={setApplyBillId}>
                    <SelectTrigger>
                      <SelectValue placeholder={t("selectBill")} />
                    </SelectTrigger>
                    <SelectContent>
                      {bills.map((inv) => (
                        <SelectItem key={inv.id} value={inv.id}>
                          {t("billOption", { number: inv.billNumber, name: inv.contact?.name || t("unknown"), amount: debitNoteUiMoney(inv.amountDue, inv.currencyCode, unitPresentation) })}
                        </SelectItem>
                      ))}
                      {bills.length === 0 && (
                        <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                          {t("noBills", { currency: currencyLabel(dn.currencyCode, unitPresentation.locale) })}
                        </div>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t("amount")}</Label>
                  <InvoiceAmountInput
                    currency={dn.currencyCode}
                    label={t("amount")}
                    invalidMessage={t("invalidAmount")}
                    value={applyAmount}
                    onChange={setApplyAmount}
                    placeholder={invoiceUiDecimal(dn.amountRemaining, dn.currencyCode)}
                  />
                  <p className="text-xs text-muted-foreground">
                    {t("remainingCredit", { amount: debitNoteUiMoney(dn.amountRemaining, dn.currencyCode, unitPresentation) })}
                  </p>
                </div>
                {billError && <p role="alert" className="text-xs text-destructive">{t(billError)}</p>}
                {applicationError && <p role="alert" className="text-xs text-destructive">{applicationError}</p>}
                <Button
                  onClick={handleApply}
                  loading={applyLoading}
                  disabled={!application || !!billError || applyLoading}
                  className="w-full bg-emerald-600 hover:bg-emerald-700"
                >
                  {t("reduceBill")}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
        {dn.status !== "void" && (
          <Button variant="outline" size="sm" onClick={handleVoid} className="text-red-600" title={t("voidHint")}>
            <Ban className="mr-2 size-4" />{t("voidAction")}
          </Button>
        )}
      </PageHeader>

      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <Badge variant="outline" className={statusColors[dn.status] || ""}>
          {debitNoteStatusLabel(t, dn.status)}
        </Badge>
        <span className="text-xs sm:text-sm text-muted-foreground">
          {t("issued", { date: dn.issueDate })}
        </span>
        {dn.reference && <span className="text-xs sm:text-sm text-muted-foreground">{t("referenceValue", { reference: dn.reference })}</span>}
      </div>

      <DebitNoteMoneyDetails credit={dn} />

      {dn.notes && (
        <div className="rounded-lg border p-4">
          <p className="text-xs font-medium text-muted-foreground mb-1">{t("notes")}</p>
          <p className="text-sm">{dn.notes}</p>
        </div>
      )}

      <EmailHistory key={emailHistoryKey} documentType="debit_note" documentId={id} />

      <SendDocumentDialog
        open={sendDialogOpen}
        onOpenChange={setSendDialogOpen}
        documentType="debit_note"
        documentId={id}
        documentNumber={dn.debitNoteNumber}
        contactEmail={dn.contact?.email}
        contactName={dn.contact?.name}
        organizationName={orgName}
        amountDue={dn.total}
        currencyCode={dn.currencyCode}
        issueDate={dn.issueDate}
        sendApiUrl={`/api/v1/debit-notes/${id}/send`}
        onSent={handleSendComplete}
      />

      {confirmDialog}
    </div>
  );
}
