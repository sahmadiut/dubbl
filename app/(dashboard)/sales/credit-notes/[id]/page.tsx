"use client";

import { BidiText } from "@/components/ui/bidi-text";
import { localeDirection } from "@/i18n/locale";

import { usePresentation } from "@/i18n/provider";
import { currencyLabel } from "@/i18n/currency-labels";
import { useTranslations } from "next-intl";
import { creditNoteStatusLabel } from "@/i18n/credit-note-presentation";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Send, Ban, FileText } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InvoiceAmountInput } from "@/components/dashboard/invoice-amount-input";
import { CreditNoteMoneyDetails } from "@/components/dashboard/credit-note-money-details";
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
import { creditNoteUiDocument, creditNoteUiInvoice, creditNoteUiInvoiceEligible, creditNoteUiApplication, creditNoteUiMoney } from "@/lib/money/credit-note-ui";
import { invoiceUiDecimal } from "@/lib/money/invoice-ui";
import { useConfirm } from "@/lib/hooks/use-confirm";
import { useEntityTitle } from "@/lib/hooks/use-entity-title";
import { SendDocumentDialog } from "@/components/dashboard/send-document-dialog";
import { EmailHistory } from "@/components/dashboard/email-history";
import Link from "next/link";

interface CreditNoteDetail {
  currencyCode: string;
  id: string;
  creditNoteNumber: string;
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
  invoiceId: string | null;
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

type CreditNoteWire = Omit<CreditNoteDetail, "subtotal" | "taxTotal" | "total" | "amountApplied" | "amountRemaining" | "lines"> & {
  subtotal: number; taxTotal: number; total: number; amountApplied: number; amountRemaining: number;
  lines: (Omit<CreditNoteDetail["lines"][number], "unitPrice" | "amount" | "taxAmount"> & { unitPrice: number; amount: number; taxAmount: number; [key: string]: unknown })[];
  [key: string]: unknown;
};
interface InvoiceOption {
  id: string; invoiceNumber: string; contactId: string | null; currencyCode: string; status: string;
  amountDue: bigint; contact: { name: string } | null;
}
type InvoiceWire = Omit<InvoiceOption, "amountDue"> & { amountDue: number; [key: string]: unknown };

export default function CreditNoteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const orgId = typeof window !== "undefined" ? localStorage.getItem("activeOrgId") : null;
  return <CreditNoteDetail key={`${orgId}:${id}`} id={id} orgId={orgId} />;
}

function CreditNoteDetail({ id, orgId }: { id: string; orgId: string | null }) {
  const unitPresentation = usePresentation();
  const t = useTranslations("CreditNotes");
  const { confirm, dialog: confirmDialog } = useConfirm();
  const [cn, setCn] = useState<CreditNoteDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [applyOpen, setApplyOpen] = useState(false);
  const [applyLoading, setApplyLoading] = useState(false);
  const [applyInvoiceId, setApplyInvoiceId] = useState("");
  const [applyAmount, setApplyAmount] = useState("");
  const [invoiceLoaded, setInvoiceLoaded] = useState<{ context: string; rows: InvoiceOption[]; error: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);

  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [emailHistoryKey, setEmailHistoryKey] = useState(0);
  const [orgName, setOrgName] = useState("");

  useEntityTitle(cn?.creditNoteNumber);

  useEffect(() => {
    if (!orgId) return;
    const controller = new AbortController();
    fetch(`/api/v1/credit-notes/${id}`, { headers: { "x-organization-id": orgId }, signal: controller.signal })
      .then(r => { if (!r.ok) throw new Error("Unable to load credit note"); return r.json(); })
      .then(data => { const credit = creditNoteUiDocument(data.creditNote as CreditNoteWire); if (!controller.signal.aborted) { setCn(credit); setError(null); } })
      .catch(() => { if (!controller.signal.aborted) { setCn(null); setError(t("readFailed")); } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    fetch("/api/v1/organization", { headers: { "x-organization-id": orgId }, signal: controller.signal })
      .then(r => r.json()).then(data => { if (!controller.signal.aborted && data.organization?.name) setOrgName(data.organization.name); }).catch(() => {});
    return () => controller.abort();
  }, [id, orgId, reload, t]);

  const invoiceContext = `${cn?.contactId}:${cn?.currencyCode}:${cn?.amountRemaining}:${reload}`;
  const invoices = invoiceLoaded?.context === invoiceContext ? invoiceLoaded.rows : [];
  const invoiceError = invoiceLoaded?.context === invoiceContext ? invoiceLoaded.error : null;
  useEffect(() => {
    if (!orgId || !applyOpen || !cn?.contactId) return;
    const controller = new AbortController();
    const params = new URLSearchParams({ limit: "100", contactId: cn.contactId });
    fetch(`/api/v1/invoices?${params}`, { headers: { "x-organization-id": orgId }, signal: controller.signal })
      .then(r => { if (!r.ok) throw new Error("Unable to load invoices"); return r.json(); })
      .then(data => {
        if (!data || !Array.isArray(data.data)) throw new Error("Unable to load invoices");
        const rows = data.data.map((row: InvoiceWire) => creditNoteUiInvoice(row)).filter((inv: InvoiceOption) => creditNoteUiInvoiceEligible(cn, inv));
        if (!controller.signal.aborted) setInvoiceLoaded({ context: invoiceContext, rows, error: null });
      })
      .catch(() => { if (!controller.signal.aborted) setInvoiceLoaded({ context: invoiceContext, rows: [], error: t("invoiceReadFailed") }); });
    return () => controller.abort();
  }, [orgId, applyOpen, cn, invoiceContext, t]);

  function handleSendComplete() {
    if (!active.current) return;
    setSendDialogOpen(false);
    setCn(null); setLoading(true); setReload(k => k + 1);
    setEmailHistoryKey(k => k + 1);
  }

  let application: ReturnType<typeof creditNoteUiApplication> | null = null;
  let applicationError: string | null = null;
  const selectedInvoice = invoices.find(inv => inv.id === applyInvoiceId);
  if (cn && selectedInvoice && applyAmount !== "") {
    try { application = creditNoteUiApplication(applyAmount, cn, selectedInvoice); }
    catch { applicationError = t("invalidAmount"); }
  }

  async function handleApply() {
    if (!orgId || !cn || !selectedInvoice) return;
    setApplyLoading(true);
    try {
      const payload = creditNoteUiApplication(applyAmount, cn, selectedInvoice);
      const res = await fetch(`/api/v1/credit-notes/${id}/apply`, {
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
        setApplyInvoiceId("");
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
          const res = await fetch(`/api/v1/credit-notes/${id}/void`, {
            method: "POST",
            headers: { "x-organization-id": orgId },
          });
          if (!active.current) return;
          if (!res.ok) { toast.error(t("voidFailed")); return; }
          handleSendComplete();
          toast.success(t("voidSuccess"));
        } catch {
          if (active.current) toast.error(t("voidFailed"));
        }
      },
    });
  }

  if (loading) return <div className="space-y-6 min-w-0 [overflow-wrap:anywhere]"><PageHeader title={t("loading")} /></div>;
  if (error) return <p role="alert" className="text-sm text-destructive">{error}</p>;
  if (!cn) return <div className="space-y-6 min-w-0 [overflow-wrap:anywhere]"><PageHeader title={t("notFound")} /></div>;

  return (
    <div className="space-y-6 min-w-0 [overflow-wrap:anywhere]">
      <PageHeader title={cn.creditNoteNumber} description={t("recipient", { name: cn.contact?.name || t("unknown") })}>
        <Button variant="outline" size="sm" asChild>
          <Link href="/sales/credit-notes"><ArrowLeft className="me-2 size-4 rtl:rotate-180" />{t("back")}</Link>
        </Button>
        {cn.status === "draft" && (
          <Button size="sm" onClick={() => setSendDialogOpen(true)} className="bg-emerald-600 hover:bg-emerald-700 h-auto min-h-8 whitespace-normal text-start">
            <Send className="me-2 size-4" />{t("send")}
          </Button>
        )}
        {cn.status === "sent" && cn.amountRemaining > 0n && (
          <Dialog open={applyOpen} onOpenChange={(open) => {
            setApplyOpen(open);
            if (open) { setInvoiceLoaded(null); setApplyInvoiceId(""); setApplyAmount(""); }
          }}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 h-auto min-h-8 whitespace-normal text-start" title={t("applyHint")}>
                <FileText className="me-2 size-4" />{t("applyAction")}
              </Button>
            </DialogTrigger>
            <DialogContent dir={localeDirection(unitPresentation.locale)} className="max-h-dvh overflow-y-auto [overflow-wrap:anywhere]">
              <DialogHeader>
                <DialogTitle>{t("applyTitle")}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="credit-apply-invoice">{t("invoice")}</Label>
                  <Select dir={localeDirection(unitPresentation.locale)} value={applyInvoiceId} onValueChange={setApplyInvoiceId}>
                    <SelectTrigger id="credit-apply-invoice" className="h-auto min-h-9 whitespace-normal *:data-[slot=select-value]:line-clamp-none">
                      <SelectValue placeholder={t("selectInvoice")} />
                    </SelectTrigger>
                    <SelectContent>
                      {invoices.map((inv) => (
                        <SelectItem key={inv.id} value={inv.id}>
                          <BidiText>{t("invoiceOption", { number: inv.invoiceNumber, name: inv.contact?.name || t("unknown"), amount: creditNoteUiMoney(inv.amountDue, inv.currencyCode, unitPresentation) })}</BidiText>
                        </SelectItem>
                      ))}
                      {invoices.length === 0 && (
                        <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                          <BidiText>{t("noInvoices", { currency: currencyLabel(cn.currencyCode, unitPresentation.locale) })}</BidiText>
                        </div>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium">{t("amount")}</p>
                  <InvoiceAmountInput
                    label={t("amount")}
                    currency={cn.currencyCode}
                    value={applyAmount}
                    onChange={setApplyAmount}
                    placeholder={invoiceUiDecimal(cn.amountRemaining, cn.currencyCode)}
                  />
                  <p className="text-xs text-muted-foreground">
                    <BidiText>{t("remainingCredit", { amount: creditNoteUiMoney(cn.amountRemaining, cn.currencyCode, unitPresentation) })}</BidiText>
                  </p>
                </div>
                {invoiceError && <p role="alert" className="text-xs text-destructive">{invoiceError}</p>}
                {applicationError && <p role="alert" className="text-xs text-destructive">{applicationError}</p>}
                <Button
                  onClick={handleApply}
                  loading={applyLoading}
                  disabled={!application || !!invoiceError}
                  className="w-full bg-emerald-600 hover:bg-emerald-700"
                >
                  {t("reduceInvoice")}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
        {cn.status !== "void" && (
          <Button variant="outline" size="sm" onClick={handleVoid} className="text-red-600 h-auto min-h-8 whitespace-normal text-start" title={t("voidHint")}>
            <Ban className="me-2 size-4" />{t("voidAction")}
          </Button>
        )}
      </PageHeader>

      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <Badge variant="outline" className={statusColors[cn.status] || ""}>
          <BidiText>{creditNoteStatusLabel(t, cn.status)}</BidiText>
        </Badge>
        <span className="text-xs sm:text-sm text-muted-foreground">
          <BidiText>{t("issued", { date: cn.issueDate })}</BidiText>
        </span>
      </div>

      <CreditNoteMoneyDetails credit={cn} />

      {cn.notes && (
        <div className="rounded-lg border p-4">
          <p className="text-xs font-medium text-muted-foreground mb-1">{t("notes")}</p>
          <p className="text-sm whitespace-pre-wrap"><BidiText>{cn.notes}</BidiText></p>
        </div>
      )}

      <EmailHistory key={emailHistoryKey} documentType="credit_note" documentId={id} />

      <SendDocumentDialog
        open={sendDialogOpen}
        onOpenChange={setSendDialogOpen}
        documentType="credit_note"
        documentId={id}
        documentNumber={cn.creditNoteNumber}
        contactEmail={cn.contact?.email}
        contactName={cn.contact?.name}
        organizationName={orgName}
        amountDue={cn.total}
        currencyCode={cn.currencyCode}
        issueDate={cn.issueDate}
        sendApiUrl={`/api/v1/credit-notes/${id}/send`}
        onSent={handleSendComplete}
      />

      {confirmDialog}
    </div>
  );
}
