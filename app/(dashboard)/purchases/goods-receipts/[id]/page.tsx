"use client";

import { useTranslations } from "next-intl";
import { goodsReceiptStatusLabel } from "@/i18n/goods-receipt-presentation";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Truck, PackageCheck, BookOpen, ReceiptText, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { procurementReceipt, procurementMoney } from "@/lib/money/procurement-ui";
import type { ProcurementWire } from "@/lib/money/procurement-ui";
import { ProcurementMoneyDetails } from "@/components/dashboard/procurement-money-details";
import { useEntityTitle } from "@/lib/hooks/use-entity-title";
import { toast } from "sonner";
import Link from "next/link";

interface GoodsReceiptDetail {
  currencyCode: string;
  total: bigint;
  id: string;
  receiptNumber: string;
  date: string;
  status: string;
  notes: string | null;
  purchaseOrderId: string | null;
  contact: { name: string } | null;
  purchaseOrder: { id: string; poNumber: string } | null;
  lines: {
    id: string;
    description: string;
    quantityReceived: number;
    amount: bigint;
    unitCost: bigint;
    journalEntryId: string | null;
    inventoryItem: { name: string; sku: string | null } | null;
    warehouse: { name: string } | null;
  }[];
}

const statusColors: Record<string, string> = {
  draft: "",
  received: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  billed: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300",
  void: "border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-300",
};

export default function GoodsReceiptDetailPage() {
  const { id } = useParams<{ id: string }>();
  const orgId = typeof window !== "undefined" ? localStorage.getItem("activeOrgId") : null;
  return <GoodsReceiptDetailContent key={`${orgId}:${id}`} />;
}

function GoodsReceiptDetailContent() {
  const t = useTranslations("GoodsReceipts");
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [gr, setGr] = useState<GoodsReceiptDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [readError, setReadError] = useState<string | null>(null);
  const [billing, setBilling] = useState(false);

  const orgId = typeof window !== "undefined" ? localStorage.getItem("activeOrgId") : null;

  async function handleCreateBill() {
    if (!orgId) return;
    setBilling(true);
    try {
      const res = await fetch(`/api/v1/goods-receipts/${id}/create-bill`, {
        method: "POST",
        headers: { "x-organization-id": orgId },
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(t("createBillFailed"));
        return;
      }
      toast.success(t("billCreated"));
      router.push(`/purchases/${data.bill.id}`);
    } catch {
      toast.error(t("createBillFailed"));
    } finally {
      setBilling(false);
    }
  }

  useEntityTitle(gr?.receiptNumber);

  useEffect(() => {
    if (!orgId) return;
    const controller = new AbortController();
    fetch(`/api/v1/goods-receipts/${id}`, { headers: { "x-organization-id": orgId }, signal: controller.signal })
      .then(r => { if (!r.ok) throw new Error(t("detailReadFailed")); return r.json(); })
      .then(data => { if (!controller.signal.aborted) { setGr(procurementReceipt(data.goodsReceipt as ProcurementWire<GoodsReceiptDetail>)); setReadError(null); } })
      .catch(() => { if (!controller.signal.aborted) { setGr(null); setReadError(t("detailReadFailed")); } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [id, orgId, t]);

  if (readError) return <p role="alert" className="text-sm text-red-600">{readError}</p>;
  if (loading) return <div className="space-y-6"><PageHeader title={t("loading")} /></div>;
  if (!gr) return <div className="space-y-6"><PageHeader title={t("notFound")} /></div>;

  const totalValue = gr.total;
  // First line carrying a journal entry — the GRNI posting for this receipt.
  const journalEntryId = gr.lines.find((l) => l.journalEntryId)?.journalEntryId ?? null;

  return (
    <div className="space-y-6">
      <PageHeader title={gr.receiptNumber} description={t("fromSupplier", { name: gr.contact?.name || t("unknown") })}>
        <Button variant="outline" size="sm" asChild>
          <Link href="/purchases/goods-receipts"><ArrowLeft className="mr-2 size-4" />{t("back")}</Link>
        </Button>
        {gr.purchaseOrder && (
          <Button variant="outline" size="sm" asChild title={t("openOrderTooltip")}>
            <Link href={`/purchases/orders/${gr.purchaseOrder.id}`}>
              <Truck className="mr-2 size-4" />{t("viewOrder", { number: gr.purchaseOrder.poNumber })}
            </Link>
          </Button>
        )}
        {gr.status === "received" && (
          <Button
            size="sm"
            onClick={handleCreateBill}
            disabled={billing}
            title={t("createBillTooltip")}
          >
            {billing ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <ReceiptText className="mr-2 size-4" />
            )}
            {t("createBill")}
          </Button>
        )}
        {journalEntryId && (
          <Button variant="outline" size="sm" asChild title={t("journalTooltip")}>
            <Link href={`/accounting/${journalEntryId}`}>
              <BookOpen className="mr-2 size-4" />{t("viewJournal")}
            </Link>
          </Button>
        )}
      </PageHeader>

      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <Badge variant="outline" className={statusColors[gr.status] || ""}>
          {goodsReceiptStatusLabel(t, gr.status)}
        </Badge>
        <span className="text-xs sm:text-sm text-muted-foreground">
          {t("receivedDate", { date: gr.date })}
        </span>
        {gr.purchaseOrder && (
          <Link
            href={`/purchases/orders/${gr.purchaseOrder.id}`}
            className="text-xs sm:text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            {t("orderNumber", { number: gr.purchaseOrder.poNumber })}
          </Link>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border p-4">
          <p className="text-xs text-muted-foreground">{t("valueReceived")}</p>
          <p className="text-xl font-bold font-mono break-all">{procurementMoney(totalValue, gr.currencyCode)}</p>
        </div>
        <div className="rounded-lg border p-4">
          <div className="flex items-center gap-2">
            <PackageCheck className="size-3.5 text-emerald-600" />
            <p className="text-xs text-muted-foreground">{t("itemsReceived")}</p>
          </div>
          <p className="text-sm font-medium mt-1">
            {t("itemCount", { count: gr.lines.length })}
          </p>
        </div>
      </div>

      <ProcurementMoneyDetails document={gr} receipt />

      {gr.notes && (
        <div className="rounded-lg border p-4">
          <p className="text-xs font-medium text-muted-foreground mb-1">{t("notes")}</p>
          <p className="text-sm">{gr.notes}</p>
        </div>
      )}
    </div>
  );
}
