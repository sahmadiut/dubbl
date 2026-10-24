"use client";

import { usePresentation } from "@/i18n/provider";
import { currencyLabel } from "@/i18n/currency-labels";
import { useTranslations } from "next-intl";
import { customerPrepaymentStatusLabel, customerPrepaymentSourceLabel } from "@/i18n/customer-prepayment-presentation";
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
  const unitPresentation = usePresentation();
  const t = useTranslations("CustomerPrepayments");
  const [cc, setCc] = useState<CustomerCreditDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [applyOpen, setApplyOpen] = useState(false);
  const [applyLoading, setApplyLoading] = useState(false);
  const [applyInvoiceId, setApplyInvoiceId] = useState("");
  const [applyAmount, setApplyAmount] = useState("");
  const [invoices, setInvoices] = useState<InvoiceOption[]>([]);
  const [readError, setReadError] = useState<"" | "readFailed" | "updatedReadFailed">("");
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
      .catch(() => { if (!controller.signal.aborted) setReadError("readFailed"); })
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
      .catch(() => { if (!controller.signal.aborted) { setInvoices([]); setInvoiceError("invoiceReadFailed"); } });
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
        try {
          const data = await res.json();
          setCc({ ...cc, ...customerPrepaymentRow(data.customerCredit as CustomerCreditWire) });
        } catch {
          setCc(null);
          setReadError("updatedReadFailed");
          setApplyOpen(false);
          return;
        }
        setApplyOpen(false);
        setApplyInvoiceId("");
        setApplyAmount("");
        toast.success(t("applySuccess"));
      } else {
        toast.error(t("applyFailed"));
      }
    } catch {
      toast.error(t("applyFailed"));
    } finally {
      setApplyLoading(false);
    }
  }

  if (loading) return <div className="space-y-6"><PageHeader title={t("loading")} /></div>;
  if (readError) return <p role="alert" className="text-sm text-destructive">{t(readError)}</p>;
  if (!cc) return <div className="space-y-6"><PageHeader title={t("notFound")} /></div>;

  let applicationValid = false;
  let applicationError = "";
  const selected = invoices.find(inv => inv.id === applyInvoiceId);
  if (selected && applyAmount) {
    try { customerPrepaymentApplication(applyAmount, cc, selected); applicationValid = true; }
    catch { applicationError = t("invalidAmount"); }
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t("prepayment")} description={t("recipient", { name: cc.contact?.name || t("unknown") })}>
        <Button variant="outline" size="sm" asChild>
          <Link href="/sales/customer-prepayments"><ArrowLeft className="mr-2 size-4" />{t("back")}</Link>
        </Button>
        {cc.status === "open" && cc.amountRemaining > 0n && (
          <Dialog open={applyOpen} onOpenChange={(open) => {
            setApplyOpen(open); setInvoices([]); setInvoiceError(""); setApplyInvoiceId(""); setApplyAmount("");
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
                  <Label>{t("invoice")}</Label>
                  <Select value={applyInvoiceId} onValueChange={setApplyInvoiceId}>
                    <SelectTrigger>
                      <SelectValue placeholder={t("selectInvoice")} />
                    </SelectTrigger>
                    <SelectContent>
                      {invoices.map((inv) => (
                        <SelectItem key={inv.id} value={inv.id}>
                          {t("invoiceOption", { number: inv.invoiceNumber, name: inv.contact?.name || t("unknown"), amount: formatMoney(inv.amountDue, inv.currencyCode, unitPresentation) })}
                        </SelectItem>
                      ))}
                      {invoices.length === 0 && (
                        <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                          {t("noInvoices", { currency: currencyLabel(cc.currencyCode, unitPresentation.locale) })}
                        </div>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t("amount")}</Label>
                  <InvoiceAmountInput
                    currency={cc.currencyCode}
                    value={applyAmount}
                    onChange={setApplyAmount}
                    placeholder={customerPrepaymentDecimal(cc.amountRemaining, cc.currencyCode)}
                  />
                  <p className="text-xs text-muted-foreground">
                    {t("availableCredit", { amount: formatMoney(cc.amountRemaining, cc.currencyCode, unitPresentation) })}
                  </p>
                </div>
                {invoiceError && <p role="alert" className="text-sm text-destructive">{t("invoiceReadFailed")}</p>}
                {applicationError && <p role="alert" className="text-sm text-destructive">{applicationError}</p>}
                <Button
                  onClick={handleApply}
                  loading={applyLoading}
                  disabled={!applicationValid || !!invoiceError}
                  className="w-full bg-emerald-600 hover:bg-emerald-700"
                >
                  {t("applySubmit")}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </PageHeader>

      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <Badge variant="outline" className={statusColors[cc.status] || ""}>
          {customerPrepaymentStatusLabel(t, cc.status)}
        </Badge>
        <span className="text-xs sm:text-sm text-muted-foreground">
          {customerPrepaymentSourceLabel(t, cc.sourceType)}
        </span>
        <span className="text-xs sm:text-sm text-muted-foreground">
          {t("received", { date: cc.date })}
        </span>
      </div>

      <CustomerPrepaymentMoneyDetails credit={cc} />

      {cc.notes && (
        <div className="rounded-lg border p-4">
          <p className="text-xs font-medium text-muted-foreground mb-1">{t("notes")}</p>
          <p className="text-sm">{cc.notes}</p>
        </div>
      )}
    </div>
  );
}
