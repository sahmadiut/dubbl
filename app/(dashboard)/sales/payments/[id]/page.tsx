"use client";

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

const methodLabels: Record<string, string> = {
  bank_transfer: "Bank transfer",
  cash: "Cash",
  check: "Check",
  card: "Card",
  other: "Other",
};

export default function PaymentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const orgId = typeof window !== "undefined" ? localStorage.getItem("activeOrgId") : null;
  return <PaymentDetail key={`${orgId}:${id}`} id={id} orgId={orgId} />;
}
function PaymentDetail({ id, orgId }: { id: string; orgId: string | null }) {
  const [pmt, setPmt] = useState<PaymentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  // Maps invoice id -> invoice number so allocations can show which invoice
  // they settled (the payment only stores the document id + amount).
  const [invoiceLookup, setInvoiceLookup] = useState<Record<string, InvoiceOption>>({});

  const [readError, setReadError] = useState("");

  useEntityTitle(pmt ? `Payment ${pmt.paymentNumber}` : undefined);

  const loadPayment = useCallback((signal?: AbortSignal) => {
    if (!orgId) return;
    fetch(`/api/v1/payments/${id}`, {
      headers: { "x-organization-id": orgId }, signal,
    })
      .then((r) => { if (!r.ok) throw new Error("Unable to load payment"); return r.json(); })
      .then((data) => {
        const saved = data.payment ? paymentUiRow(data.payment) as unknown as PaymentDetail : null;
        if (!signal?.aborted) setPmt(saved);
      })
      .catch(() => { if (!signal?.aborted) { setPmt(null); setReadError("Payment amounts are unavailable. Reload to try again."); } })
      .finally(() => { if (!signal?.aborted) setLoading(false); });
  }, [id, orgId]);

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
  if (loading) return <div className="space-y-6"><PageHeader title="Loading..." /></div>;
  if (!pmt) return <div className="space-y-6"><PageHeader title="Payment not found" /></div>;

  const allocatedTotal = pmt.allocated;
  const unallocated = pmt.unallocated;
  const cur = pmt.currencyCode;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Payment ${pmt.paymentNumber}`}
        description={`From: ${pmt.contact?.name || "Unknown"}`}
      >
        <Button variant="outline" size="sm" asChild>
          <Link href="/sales/payments"><ArrowLeft className="mr-2 size-4" />Back</Link>
        </Button>
      </PageHeader>

      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <Badge variant="outline">{methodLabels[pmt.method] || pmt.method}</Badge>
        <span className="text-xs sm:text-sm text-muted-foreground">Received {pmt.date}</span>
        {pmt.reference && <span className="text-xs sm:text-sm text-muted-foreground">Ref: {pmt.reference}</span>}
        {pmt.bankAccount && <span className="text-xs sm:text-sm text-muted-foreground">Into: {pmt.bankAccount.name}</span>}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border p-4">
          <div className="flex items-center gap-2">
            <Banknote className="size-3.5 text-emerald-600" />
            <p className="text-xs text-muted-foreground">Payment amount</p>
          </div>
          <p className="text-xl font-bold font-mono break-all mt-1">{formatMoney(pmt.amount, cur)}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-xs text-muted-foreground">Put toward invoices</p>
          <p className="text-xl font-bold font-mono break-all text-emerald-600 mt-1">{formatMoney(allocatedTotal, cur)}</p>
        </div>
        <div className="rounded-lg border p-4">
          <div className="flex items-center gap-2">
            <Wallet className="size-3.5 text-amber-600" />
            <p className="text-xs text-muted-foreground">Not yet used</p>
          </div>
          <p className="text-xl font-bold font-mono break-all text-amber-600 mt-1">{formatMoney(unallocated, cur)}</p>
        </div>
      </div>

      {unallocated > 0n && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          {formatMoney(unallocated, cur)} of this payment hasn&apos;t been put toward any invoice yet.
          This historical balance cannot be allocated here. Recording another payment would record new cash; review the original payment before making a correction.
        </div>
      )}

      <div className="rounded-lg border">
        <div className="border-b px-4 py-3">
          <h2 className="text-sm font-semibold">Invoices this payment covers</h2>
        </div>
        {pmt.allocations.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            This payment isn&apos;t linked to any invoice yet.
          </div>
        ) : (
          <ul className="divide-y">
            {pmt.allocations.map((a, idx) => {
              const inv = a.documentType === "invoice" ? invoiceLookup[a.documentId] : undefined;
              return (
                <li key={`${a.documentId}-${idx}`} className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-2 text-sm">
                    <FileText className="size-3.5 text-muted-foreground" />
                    {inv ? (
                      <Link
                        href={`/sales/invoices/${a.documentId}`}
                        className="font-medium hover:underline"
                      >
                        {inv.invoiceNumber}
                      </Link>
                    ) : (
                      <span className="font-medium capitalize">{a.documentType}</span>
                    )}
                    {inv?.contact?.name && (
                      <span className="text-muted-foreground">· {inv.contact.name}</span>
                    )}
                  </div>
                  <span className="font-mono text-sm tabular-nums break-all font-medium text-emerald-600">
                    {formatMoney(a.amount, cur)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {pmt.notes && (
        <div className="rounded-lg border p-4">
          <p className="text-xs font-medium text-muted-foreground mb-1">Notes</p>
          <p className="text-sm">{pmt.notes}</p>
        </div>
      )}
    </div>
  );
}
