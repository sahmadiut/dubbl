"use client";

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

// Plain-language status labels (end users aren't accountants).
const statusLabels: Record<string, string> = {
  draft: "draft",
  sent: "sent",
  applied: "used",
  void: "cancelled",
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
  const { confirm, dialog: confirmDialog } = useConfirm();
  const [dn, setDn] = useState<DebitNoteDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [applyOpen, setApplyOpen] = useState(false);
  const [applyLoading, setApplyLoading] = useState(false);
  const [applyBillId, setApplyBillId] = useState("");
  const [applyAmount, setApplyAmount] = useState("");
  const [billLoaded, setBillLoaded] = useState<{ context: string; rows: BillOption[]; error: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
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
      .catch(() => { if (!controller.signal.aborted) { setDn(null); setError("Unable to load valid supplier credit amounts. Try again."); } })
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
      .catch(() => { if (!controller.signal.aborted) setBillLoaded({ context: billContext, rows: [], error: "Unable to load valid bill balances. Try again." }); });
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
    catch (error) { applicationError = error instanceof Error ? error.message : "Enter a valid amount"; }
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
        toast.success("Credit used to reduce the bill");
      } else {
        const data = await res.json();
        toast.error(typeof data.error === "string" ? data.error : "Couldn't use this credit");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't use this credit");
    } finally {
      if (active.current) setApplyLoading(false);
    }
  }

  async function handleVoid() {
    if (!orgId) return;
    await confirm({
      title: "Cancel this supplier credit?",
      description: "This stops the credit from being used against any bill. You can't undo this.",
      confirmLabel: "Cancel supplier credit",
      destructive: true,
      onConfirm: async () => {
        const res = await fetch(`/api/v1/debit-notes/${id}/void`, {
          method: "POST",
          headers: { "x-organization-id": orgId },
        });
        if (res.ok) {
          if (!active.current) return;
          handleSendComplete();
          toast.success("Supplier credit cancelled");
        }
      },
    });
  }

  if (loading) return <div className="space-y-6"><PageHeader title="Loading..." /></div>;
  if (error) return <p role="alert" className="text-sm text-destructive">{error}</p>;
  if (!dn) return <div className="space-y-6"><PageHeader title="Supplier credit not found" /></div>;

  return (
    <div className="space-y-6">
      <PageHeader title={dn.debitNoteNumber} description={`From: ${dn.contact?.name || "Unknown"}`}>
        <Button variant="outline" size="sm" asChild>
          <Link href="/purchases/debit-notes"><ArrowLeft className="mr-2 size-4" />Back</Link>
        </Button>
        {dn.status === "draft" && (
          <Button size="sm" onClick={() => setSendDialogOpen(true)} className="bg-emerald-600 hover:bg-emerald-700">
            <Send className="mr-2 size-4" />Send
          </Button>
        )}
        {dn.status === "sent" && dn.amountRemaining > 0n && (
          <Dialog open={applyOpen} onOpenChange={(open) => {
            setApplyOpen(open);
            if (open) { setBillLoaded(null); setApplyBillId(""); setApplyAmount(""); }
          }}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" title="Use this credit to reduce what you owe on a bill">
                <FileText className="mr-2 size-4" />Use against a bill
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Use this credit against a bill</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Bill</Label>
                  <p className="text-xs text-muted-foreground">Matching outstanding bills from the latest 100 bills.</p>
                  <Select value={applyBillId} onValueChange={setApplyBillId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a bill..." />
                    </SelectTrigger>
                    <SelectContent>
                      {bills.map((inv) => (
                        <SelectItem key={inv.id} value={inv.id}>
                          {inv.billNumber} · {inv.contact?.name || "Unknown"} · Due: {debitNoteUiMoney(inv.amountDue, inv.currencyCode)}
                        </SelectItem>
                      ))}
                      {bills.length === 0 && (
                        <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                          No outstanding bills for this supplier in {dn.currencyCode}
                        </div>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Amount</Label>
                  <InvoiceAmountInput
                    currency={dn.currencyCode}
                    value={applyAmount}
                    onChange={setApplyAmount}
                    placeholder={invoiceUiDecimal(dn.amountRemaining, dn.currencyCode)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Remaining credit: {debitNoteUiMoney(dn.amountRemaining, dn.currencyCode)}
                  </p>
                </div>
                {billError && <p role="alert" className="text-xs text-destructive">{billError}</p>}
                {applicationError && <p role="alert" className="text-xs text-destructive">{applicationError}</p>}
                <Button
                  onClick={handleApply}
                  loading={applyLoading}
                  disabled={!application || !!billError || applyLoading}
                  className="w-full bg-emerald-600 hover:bg-emerald-700"
                >
                  Reduce the bill
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
        {dn.status !== "void" && (
          <Button variant="outline" size="sm" onClick={handleVoid} className="text-red-600" title="Stop this credit from being used against any bill">
            <Ban className="mr-2 size-4" />Cancel supplier credit
          </Button>
        )}
      </PageHeader>

      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <Badge variant="outline" className={statusColors[dn.status] || ""}>
          {statusLabels[dn.status] || dn.status}
        </Badge>
        <span className="text-xs sm:text-sm text-muted-foreground">
          Issued {dn.issueDate}
        </span>
        {dn.reference && <span className="text-xs sm:text-sm text-muted-foreground">Ref: {dn.reference}</span>}
      </div>

      <DebitNoteMoneyDetails credit={dn} />

      {dn.notes && (
        <div className="rounded-lg border p-4">
          <p className="text-xs font-medium text-muted-foreground mb-1">Notes</p>
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
