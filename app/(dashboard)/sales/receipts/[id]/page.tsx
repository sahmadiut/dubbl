"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, Banknote, Landmark } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { salesReceiptUiDocument, salesReceiptUiMoney } from "@/lib/money/sales-receipt-ui";
import { SalesReceiptMoneyDetails } from "@/components/dashboard/sales-receipt-money-details";
import { useEntityTitle } from "@/lib/hooks/use-entity-title";
import Link from "next/link";

interface SalesReceiptDetail {
  id: string;
  receiptNumber: string;
  date: string;
  status: string;
  reference: string | null;
  notes: string | null;
  subtotal: bigint;
  taxTotal: bigint;
  total: bigint;
  currencyCode: string;
  contact: { name: string; email: string | null } | null;
  bankAccount: { accountName: string } | null;
  depositAccount: { code: string; name: string } | null;
  lines: {
    id: string;
    description: string;
    quantity: number;
    unitPrice: bigint;
    amount: bigint;
    taxAmount: bigint;
  }[];
}

interface SalesReceiptWire extends Omit<SalesReceiptDetail, "subtotal" | "taxTotal" | "total" | "lines"> {
  subtotal: number; taxTotal: number; total: number;
  lines: (Omit<SalesReceiptDetail["lines"][number], "unitPrice" | "amount" | "taxAmount"> & {
    unitPrice: number; amount: number; taxAmount: number; [key: string]: unknown;
  })[];
  [key: string]: unknown;
}

const statusColors: Record<string, string> = {
  draft: "",
  paid: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  void: "border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-300",
};

// Plain-language status labels (end users aren't accountants).
const statusLabels: Record<string, string> = {
  draft: "draft",
  paid: "paid",
  void: "cancelled",
};

export default function SalesReceiptDetailPage() {
  const { id } = useParams<{ id: string }>();
  const orgId = typeof window !== "undefined" ? localStorage.getItem("activeOrgId") : null;
  return <SalesReceiptDetailContent key={`${orgId}:${id}`} id={id} orgId={orgId} />;
}

function SalesReceiptDetailContent({ id, orgId }: { id: string; orgId: string | null }) {
  const [sr, setSr] = useState<SalesReceiptDetail | null>(null);
  const [loading, setLoading] = useState(!!orgId);
  const [error, setError] = useState<string | null>(null);
  useEntityTitle(sr?.receiptNumber);

  useEffect(() => {
    const controller = new AbortController();
    if (!orgId) return;
    fetch(`/api/v1/sales-receipts/${id}`, { headers: { "x-organization-id": orgId }, signal: controller.signal })
      .then(r => { if (!r.ok) throw new Error("Unable to load cash sale"); return r.json(); })
      .then(data => { const receipt = salesReceiptUiDocument(data.salesReceipt as SalesReceiptWire); if (!controller.signal.aborted) setSr(receipt); })
      .catch(() => { if (!controller.signal.aborted) setError("Unable to load valid cash sale amounts. Try again."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [id, orgId]);

  if (loading) return <div className="space-y-6"><PageHeader title="Loading..." /></div>;
  if (error) return <p role="alert" className="text-sm text-red-600">{error}</p>;
  if (!sr) return <div className="space-y-6"><PageHeader title="Cash sale not found" /></div>;

  const paidInto = sr.bankAccount?.accountName
    || (sr.depositAccount ? `${sr.depositAccount.code} · ${sr.depositAccount.name}` : null);

  return (
    <div className="space-y-6">
      <PageHeader title={sr.receiptNumber} description={`Sold to: ${sr.contact?.name || "Unknown"}`}>
        <Button variant="outline" size="sm" asChild>
          <Link href="/sales/receipts"><ArrowLeft className="mr-2 size-4" />Back</Link>
        </Button>
      </PageHeader>

      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <Badge variant="outline" className={statusColors[sr.status] || ""}>
          {statusLabels[sr.status] || sr.status}
        </Badge>
        <span className="text-xs sm:text-sm text-muted-foreground">
          {sr.date}
        </span>
        {sr.reference && (
          <span className="text-xs sm:text-sm text-muted-foreground">
            Ref: {sr.reference}
          </span>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border p-4">
          <p className="text-xs text-muted-foreground">Total</p>
          <p className="text-xl font-bold font-mono break-all">{salesReceiptUiMoney(sr.total, sr.currencyCode)}</p>
        </div>
        <div className="rounded-lg border p-4">
          <div className="flex items-center gap-2">
            <Banknote className="size-3.5 text-emerald-600" />
            <p className="text-xs text-muted-foreground">Paid into</p>
          </div>
          <p className="text-sm font-medium mt-1 flex items-center gap-1.5">
            {paidInto ? (
              <>
                <Landmark className="size-3.5 text-muted-foreground shrink-0" />
                {paidInto}
              </>
            ) : (
              <span className="text-muted-foreground">Not recorded</span>
            )}
          </p>
        </div>
      </div>

      <SalesReceiptMoneyDetails receipt={sr} />

      {sr.notes && (
        <div className="rounded-lg border p-4">
          <p className="text-xs font-medium text-muted-foreground mb-1">Notes</p>
          <p className="text-sm">{sr.notes}</p>
        </div>
      )}
    </div>
  );
}
