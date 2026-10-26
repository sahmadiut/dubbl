"use client";

import { BidiText, IdentifierText } from "@/components/ui/bidi-text";
import { usePresentation } from "@/i18n/provider";
import { useTranslations } from "next-intl";
import { salesPaymentMethodLabel, salesPaymentDocumentLabel } from "@/i18n/sales-payment-presentation";
import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Banknote, FileText, Wallet } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { paymentUiRow, paymentUiMoney as formatMoney } from "@/lib/money/payment-ui";
import { useEntityTitle } from "@/lib/hooks/use-entity-title";

interface Allocation {
  documentType: string;
  documentId: string;
  amount: bigint;
}

interface PaymentDetail {
  id: string;
  paymentNumber: string;
  type: string;
  date: string;
  amount: bigint;
  method: string;
  reference: string | null;
  notes: string | null;
  currencyCode: string;
  contactId: string;
  contact: { name: string; email: string | null } | null;
  bankAccount: { name: string } | null;
  allocations: Allocation[];
  allocated: bigint;
  unallocated: bigint;
}

interface InvoiceOption {
  id: string;
  invoiceNumber: string;
  total: number;
  amountDue: number;
  status: string;
  currencyCode: string;
  contactId: string;
  contact: { name: string } | null;
}

export default function PaymentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const orgId = typeof window !== "undefined" ? localStorage.getItem("activeOrgId") : null;
  return <PaymentDetail key={`${orgId}:${id}`} id={id} orgId={orgId} />;
}
function PaymentDetail({ id, orgId }: { id: string; orgId: string | null }) {
  const unitPresentation = usePresentation();
  const t = useTranslations("SalesPayments");
  const [pmt, setPmt] = useState<PaymentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  // Maps invoice id -> invoice number so allocations can show which invoice
  // they settled (the payment only stores the document id + amount).
  const [invoiceLookup, setInvoiceLookup] = useState<Record<string, InvoiceOption>>({});

  const [readError, setReadError] = useState("");

  useEntityTitle(pmt ? t("paymentTitle", { number: pmt.paymentNumber }) : undefined);

  const loadPayment = useCallback((signal?: AbortSignal) => {
    if (!orgId) return;
    fetch(`/api/v1/payments/${id}`, {
      headers: { "x-organization-id": orgId }, signal,
    })
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then((data) => {
        const saved = data.payment ? paymentUiRow(data.payment) as unknown as PaymentDetail : null;
        if (!signal?.aborted) { setPmt(saved); setReadError(""); }
      })
      .catch(() => { if (!signal?.aborted) { setPmt(null); setReadError(t("readFailed")); } })
      .finally(() => { if (!signal?.aborted) setLoading(false); });
  }, [id, orgId, t]);

  useEffect(() => {
    const controller = new AbortController();
    loadPayment(controller.signal);
    return () => controller.abort();
  }, [loadPayment]);

  // Lookup is labels only; it does not authorize allocation or another cash write.
  useEffect(() => {
    if (!orgId || !pmt) return;
    const controller = new AbortController();
    fetch(`/api/v1/invoices?limit=100&contactId=${pmt.contactId}`, {
      headers: { "x-organization-id": orgId }, signal: controller.signal,
    }).then(r => { if (!r.ok) throw new Error(); return r.json(); }).then(data => {
      if (!controller.signal.aborted) setInvoiceLookup(Object.fromEntries((data.data || []).map((inv: InvoiceOption) => [inv.id, inv])));
    }).catch(() => {});
    return () => controller.abort();
  }, [orgId, pmt]);

  if (readError) return <p role="alert">{readError}</p>;
  if (loading) return <div className="min-w-0 space-y-6 [overflow-wrap:anywhere]"><PageHeader title={t("loading")} /></div>;
  if (!pmt) return <div className="min-w-0 space-y-6 [overflow-wrap:anywhere]"><PageHeader title={t("notFound")} /></div>;

  const allocatedTotal = pmt.allocated;
  const unallocated = pmt.unallocated;
  const cur = pmt.currencyCode;

  return (
    <div className="min-w-0 space-y-6 [overflow-wrap:anywhere]">
      <PageHeader
        title={t("paymentTitle", { number: pmt.paymentNumber })}
        description={t("fromCustomer", { name: pmt.contact?.name || t("unknown") })}
      >
        <Button variant="outline" size="sm" asChild>
          <Link href="/sales/payments"><ArrowLeft className="rtl:rotate-180 me-2 size-4" />{t("back")}</Link>
        </Button>
      </PageHeader>

      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <Badge variant="outline"><BidiText>{salesPaymentMethodLabel(t, pmt.method, true)}</BidiText></Badge>
        <span className="text-xs sm:text-sm text-muted-foreground"><BidiText>{t("received", { date: pmt.date })}</BidiText></span>
        {pmt.reference && <span className="text-xs sm:text-sm text-muted-foreground"><BidiText>{t("referenceValue", { reference: pmt.reference })}</BidiText></span>}
        {pmt.bankAccount && <span className="text-xs sm:text-sm text-muted-foreground"><BidiText>{t("intoAccount", { name: pmt.bankAccount.name })}</BidiText></span>}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border p-4">
          <div className="flex items-center gap-2">
            <Banknote className="size-3.5 text-emerald-600" />
            <p className="text-xs text-muted-foreground">{t("paymentAmount")}</p>
          </div>
          <p className="text-xl font-bold font-mono break-all mt-1"><BidiText>{formatMoney(pmt.amount, cur, unitPresentation)}</BidiText></p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-xs text-muted-foreground">{t("allocated")}</p>
          <p className="text-xl font-bold font-mono break-all text-emerald-600 mt-1"><BidiText>{formatMoney(allocatedTotal, cur, unitPresentation)}</BidiText></p>
        </div>
        <div className="rounded-lg border p-4">
          <div className="flex items-center gap-2">
            <Wallet className="size-3.5 text-amber-600" />
            <p className="text-xs text-muted-foreground">{t("unallocated")}</p>
          </div>
          <p className="text-xl font-bold font-mono break-all text-amber-600 mt-1"><BidiText>{formatMoney(unallocated, cur, unitPresentation)}</BidiText></p>
        </div>
      </div>

      {unallocated > 0n && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          <BidiText>{t("historicalBalance", { amount: formatMoney(unallocated, cur, unitPresentation) })}</BidiText>
        </div>
      )}

      <div className="rounded-lg border">
        <div className="border-b px-4 py-3">
          <h2 className="text-sm font-semibold">{t("coveredInvoices")}</h2>
        </div>
        {pmt.allocations.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            {t("noAllocations")}
          </div>
        ) : (
          <ul className="divide-y">
            {pmt.allocations.map((a, idx) => {
              const inv = a.documentType === "invoice" ? invoiceLookup[a.documentId] : undefined;
              return (
                <li key={`${a.documentId}-${idx}`} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div className="flex min-w-0 flex-wrap items-center gap-2 text-sm">
                    <FileText className="size-3.5 text-muted-foreground" />
                    {inv ? (
                      <Link
                        href={`/sales/invoices/${a.documentId}`}
                        className="font-medium hover:underline"
                      >
                        <IdentifierText>{inv.invoiceNumber}</IdentifierText>
                      </Link>
                    ) : (
                      <span className="font-medium capitalize"><BidiText>{salesPaymentDocumentLabel(t, a.documentType)}</BidiText></span>
                    )}
                    {inv?.contact?.name && (
                      <span className="text-muted-foreground">· <BidiText>{inv.contact.name}</BidiText></span>
                    )}
                  </div>
                  <span className="font-mono text-sm tabular-nums break-all font-medium text-emerald-600">
                    <BidiText>{formatMoney(a.amount, cur, unitPresentation)}</BidiText>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {pmt.notes && (
        <div className="rounded-lg border p-4">
          <p className="text-xs font-medium text-muted-foreground mb-1">{t("notes")}</p>
          <p className="text-sm whitespace-pre-wrap"><BidiText>{pmt.notes}</BidiText></p>
        </div>
      )}
    </div>
  );
}
