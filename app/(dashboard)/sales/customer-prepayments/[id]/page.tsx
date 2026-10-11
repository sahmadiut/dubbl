"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, FileText } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InvoiceAmountInput } from "@/components/dashboard/invoice-amount-input";
import { CustomerPrepaymentMoneyDetails } from "@/components/dashboard/customer-prepayment-money-details";
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
import { customerPrepaymentRow, customerPrepaymentInvoice, customerPrepaymentInvoiceEligible, customerPrepaymentApplication,
  customerPrepaymentMoney as formatMoney, customerPrepaymentDecimal } from "@/lib/money/customer-prepayment-ui";
import { useEntityTitle } from "@/lib/hooks/use-entity-title";
import Link from "next/link";

interface CustomerCreditDetail {
  id: string;
  date: string;
  status: string;
  originalAmount: bigint;
  amountRemaining: bigint;
  sourceType: string;
  currencyCode: string;
  notes: string | null;
  contactId: string | null;
  contact: { name: string; email: string | null } | null;
}
type CustomerCreditWire = Omit<CustomerCreditDetail, "originalAmount" | "amountRemaining"> & {
  originalAmount: number; amountRemaining: number; [key: string]: unknown;
};

const statusColors: Record<string, string> = {
  open: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300",
  applied: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  refunded: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300",
  void: "border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-300",
};

// Plain-language status labels (end users aren't accountants).
const statusLabels: Record<string, string> = {
  open: "available",
  applied: "used",
  refunded: "refunded",
  void: "cancelled",
};

// Plain-language labels for how the money arrived.
const sourceLabels: Record<string, string> = {
  prepayment: "Paid in advance",
  overpayment: "Overpaid",
  credit_note: "Credit note",
};

interface InvoiceOption {
  id: string;
  invoiceNumber: string;
  contactId: string | null;
  amountDue: bigint;
  status: string;
  currencyCode: string;
  contact: { name: string } | null;
}

export default function CustomerPrepaymentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const orgId = typeof window !== "undefined" ? localStorage.getItem("activeOrgId") : null;
  return <CustomerPrepaymentDetail key={`${orgId}:${id}`} id={id} orgId={orgId} />;
}

function CustomerPrepaymentDetail({ id, orgId }: { id: string; orgId: string | null }) {
  const [cc, setCc] = useState<CustomerCreditDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [applyOpen, setApplyOpen] = useState(false);
  const [applyLoading, setApplyLoading] = useState(false);
  const [applyInvoiceId, setApplyInvoiceId] = useState("");
  const [applyAmount, setApplyAmount] = useState("");
  const [invoices, setInvoices] = useState<InvoiceOption[]>([]);
  const [readError, setReadError] = useState("");
  const [invoiceError, setInvoiceError] = useState("");

  useEntityTitle(cc?.contact?.name);

  useEffect(() => {
    if (!orgId) return;
    const controller = new AbortController();
    fetch(`/api/v1/customer-credits/${id}`, {
      headers: { "x-organization-id": orgId },
      signal: controller.signal,
    })
      .then((r) => { if (!r.ok) throw new Error("Unable to load prepayment"); return r.json(); })
      .then((data) => {
        if (!controller.signal.aborted) setCc(customerPrepaymentRow(data.customerCredit as CustomerCreditWire));
      })
      .catch(() => { if (!controller.signal.aborted) setReadError("Unable to load valid prepayment amounts. Try again."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [id, orgId]);

  // Fetch outstanding invoices (same customer + currency) for the apply dialog.
  useEffect(() => {
    if (!orgId || !applyOpen || !cc) return;
    const controller = new AbortController();
    fetch(`/api/v1/invoices?limit=100&contactId=${encodeURIComponent(cc.contactId ?? "")}`, {
      headers: { "x-organization-id": orgId },
      signal: controller.signal,
    })
      .then((r) => { if (!r.ok) throw new Error("Unable to load invoices"); return r.json(); })
      .then((data) => {
        if (!Array.isArray(data.data)) throw new Error("Invalid invoice response");
        const rows: InvoiceOption[] = data.data.map(customerPrepaymentInvoice);
        if (!controller.signal.aborted) setInvoices(rows.filter(inv => customerPrepaymentInvoiceEligible(cc, inv)));
      })
      .catch(() => { if (!controller.signal.aborted) { setInvoices([]); setInvoiceError("Unable to load valid invoice balances. Reopen to try again."); } });
    return () => controller.abort();
  }, [orgId, applyOpen, cc]);

  async function handleApply() {
    if (!orgId || !applyInvoiceId || !cc) return;
    const selected = invoices.find(inv => inv.id === applyInvoiceId);
    if (!selected) return;
    setApplyLoading(true);
    try {
      const payload = customerPrepaymentApplication(applyAmount, cc, selected);
      const res = await fetch(`/api/v1/customer-credits/${id}/apply`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-organization-id": orgId,
        },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const data = await res.json();
        try { setCc({ ...cc, ...customerPrepaymentRow(data.customerCredit as CustomerCreditWire) }); }
        catch { setCc(null); setReadError("Unable to read the updated prepayment balance. Reload before continuing."); }
        setApplyOpen(false);
        setApplyInvoiceId("");
        setApplyAmount("");
        toast.success("Credit put towards the invoice");
      } else {
        const data = await res.json();
        toast.error(typeof data.error === "string" ? data.error : "Couldn't use this credit");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't use this credit");
    } finally {
      setApplyLoading(false);
    }
  }

  if (loading) return <div className="space-y-6"><PageHeader title="Loading..." /></div>;
  if (readError) return <p role="alert" className="text-sm text-destructive">{readError}</p>;
  if (!cc) return <div className="space-y-6"><PageHeader title="Prepayment not found" /></div>;

  let applicationValid = false;
  let applicationError = "";
  const selected = invoices.find(inv => inv.id === applyInvoiceId);
  if (selected && applyAmount) {
    try { customerPrepaymentApplication(applyAmount, cc, selected); applicationValid = true; }
    catch (error) { applicationError = error instanceof Error ? error.message : "Enter a valid amount"; }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Prepayment" description={`From: ${cc.contact?.name || "Unknown"}`}>
        <Button variant="outline" size="sm" asChild>
          <Link href="/sales/customer-prepayments"><ArrowLeft className="mr-2 size-4" />Back</Link>
        </Button>
        {cc.status === "open" && cc.amountRemaining > 0n && (
          <Dialog open={applyOpen} onOpenChange={(open) => {
            setApplyOpen(open); setInvoices([]); setInvoiceError(""); setApplyInvoiceId(""); setApplyAmount("");
          }}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" title="Put this credit towards what a customer owes on an invoice">
                <FileText className="mr-2 size-4" />Apply to an invoice
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Apply this credit to an invoice</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Invoice</Label>
                  <Select value={applyInvoiceId} onValueChange={setApplyInvoiceId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select an invoice..." />
                    </SelectTrigger>
                    <SelectContent>
                      {invoices.map((inv) => (
                        <SelectItem key={inv.id} value={inv.id}>
                          {inv.invoiceNumber} · {inv.contact?.name || "Unknown"} · Due: {formatMoney(inv.amountDue, inv.currencyCode)}
                        </SelectItem>
                      ))}
                      {invoices.length === 0 && (
                        <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                          No outstanding invoices in {cc.currencyCode}
                        </div>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Amount</Label>
                  <InvoiceAmountInput
                    currency={cc.currencyCode}
                    value={applyAmount}
                    onChange={setApplyAmount}
                    placeholder={customerPrepaymentDecimal(cc.amountRemaining, cc.currencyCode)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Available credit: {formatMoney(cc.amountRemaining, cc.currencyCode)}
                  </p>
                </div>
                {invoiceError && <p role="alert" className="text-sm text-destructive">{invoiceError}</p>}
                {applicationError && <p role="alert" className="text-sm text-destructive">{applicationError}</p>}
                <Button
                  onClick={handleApply}
                  loading={applyLoading}
                  disabled={!applicationValid || !!invoiceError}
                  className="w-full bg-emerald-600 hover:bg-emerald-700"
                >
                  Put towards the invoice
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </PageHeader>

      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <Badge variant="outline" className={statusColors[cc.status] || ""}>
          {statusLabels[cc.status] || cc.status}
        </Badge>
        <span className="text-xs sm:text-sm text-muted-foreground">
          {sourceLabels[cc.sourceType] || cc.sourceType}
        </span>
        <span className="text-xs sm:text-sm text-muted-foreground">
          Received {cc.date}
        </span>
      </div>

      <CustomerPrepaymentMoneyDetails credit={cc} />

      {cc.notes && (
        <div className="rounded-lg border p-4">
          <p className="text-xs font-medium text-muted-foreground mb-1">Notes</p>
          <p className="text-sm">{cc.notes}</p>
        </div>
      )}
    </div>
  );
}
