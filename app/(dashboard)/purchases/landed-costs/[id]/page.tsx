"use client";

import { useTranslations } from "next-intl";
import { landedCostStatusLabel, landedCostMethodLabel } from "@/i18n/landed-cost-presentation";
import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft } from "lucide-react";
import { useDocumentTitle } from "@/lib/hooks/use-document-title";
import { toast } from "sonner";
import { money, toMajorDecimal } from "@/lib/money/exact";

interface CostComponent {
  id: string;
  description: string;
  amount: number;
  accountId: string | null;
}

interface LineAllocation {
  id: string;
  componentId: string;
  purchaseOrderLineId: string;
  allocatedAmount: number;
  allocationBasis: number;
}

interface LandedCostDetail {
  id: string;
  name: string;
  allocationMethod: string;
  totalCostAmount: number;
  currencyCode: string;
  status: string;
  createdAt: string;
  allocatedAt: string | null;
  purchaseOrder?: { poNumber: string } | null;
  bill?: { billNumber: string } | null;
  components: CostComponent[];
  lineAllocations: LineAllocation[];
}

const formatMoney = (amount: number, currency: string) => `${currency} ${toMajorDecimal(money(BigInt(amount), currency))}`;

export default function LandedCostDetailPage() {
  const { id } = useParams<{ id: string }>();
  const t = useTranslations("LandedCosts");
  const [readError, setReadError] = useState(false);
  const [item, setItem] = useState<LandedCostDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useDocumentTitle(t("detailDocumentTitle"));

  const orgId =
    typeof window !== "undefined"
      ? localStorage.getItem("activeOrgId") || ""
      : "";

  const loadItem = useCallback(() => {
    if (!orgId) { setLoading(false); return; }
    fetch(`/api/v1/landed-costs/${id}`, {
      headers: { "x-organization-id": orgId },
    })
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then((data) => {
        if (!data || typeof data.id !== "string" || !Array.isArray(data.components) || !Array.isArray(data.lineAllocations)) throw new Error();
        setItem(data);
        setReadError(false);
      })
      .catch(() => setReadError(true))
      .finally(() => setLoading(false));
  }, [id, orgId]);

  useEffect(() => {
    loadItem();
  }, [loadItem]);

  async function handleAllocate() {
    try {
      const res = await fetch(`/api/v1/landed-costs/${id}/allocate`, {
        method: "POST",
        headers: { "x-organization-id": orgId },
      });

      if (!res.ok) {
        throw new Error();
      }

      const data = await res.json();
      if (typeof data?.allocation?.id !== "string" || data.allocation.id !== id || data.allocation.status !== "allocated") throw new Error();
      toast.success(t("allocatedSuccess"));
      loadItem();
    } catch {
      toast.error(t("allocateFailed"));
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-sm text-muted-foreground">{t("loading")}</p>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <p className="text-sm text-muted-foreground">{readError ? t("readFailed") : t("notFound")}</p>
        <Button variant="ghost" size="sm" asChild className="mt-2">
          <Link href="/purchases/landed-costs">{t("back")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {readError && <p role="alert" className="text-sm text-destructive">{t("readFailed")}</p>}
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild className="size-8 p-0">
            <Link href="/purchases/landed-costs" aria-label={t("back")}>
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-lg font-semibold tracking-tight">
                {item.name}
              </h1>
              <Badge
                variant={item.status === "draft" ? "secondary" : "default"}
                className={
                  item.status === "allocated"
                    ? "bg-emerald-600 hover:bg-emerald-700"
                    : ""
                }
              >
                {landedCostStatusLabel(t, item.status)}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              {t("summary", { method: landedCostMethodLabel(t, item.allocationMethod), amount: formatMoney(item.totalCostAmount, item.currencyCode) })}
            </p>
          </div>
        </div>
        {item.status === "draft" && (
          <Button
            size="sm"
            onClick={handleAllocate}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {t("allocate")}
          </Button>
        )}
      </div>

      <div className="h-px bg-gradient-to-r from-blue-500/20 via-border to-transparent" />

      {/* PO / Bill reference */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
        {item.purchaseOrder && (
          <span>{t("poReference", { number: item.purchaseOrder.poNumber })}</span>
        )}
        {item.bill && <span>{t("billReference", { number: item.bill.billNumber })}</span>}
        {!item.purchaseOrder && !item.bill && <span>{t("noSource")}</span>}
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-3">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground">{t("totalCost")}</p>
          <p className="mt-1 text-xl font-bold font-mono tabular-nums">
            {formatMoney(item.totalCostAmount, item.currencyCode)}
          </p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground">{t("components")}</p>
          <p className="mt-1 text-xl font-bold font-mono tabular-nums">
            {item.components.length}
          </p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground">{t("method")}</p>
          <p className="mt-1 text-xl font-bold truncate">
            {landedCostMethodLabel(t, item.allocationMethod)}
          </p>
        </div>
      </div>

      {/* Cost components table */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold">{t("costComponents")}</h2>
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("componentDescription")}</TableHead>
                <TableHead className="text-right">{t("amount")}</TableHead>
                <TableHead>{t("account")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {item.components.map((comp) => (
                <TableRow key={comp.id}>
                  <TableCell className="font-medium">
                    {comp.description}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm tabular-nums">
                    {formatMoney(comp.amount, item.currencyCode)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {comp.accountId || "-"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Allocation results */}
      {item.status === "allocated" && item.lineAllocations.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold">{t("results")}</h2>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("poLineId")}</TableHead>
                  <TableHead>{t("componentId")}</TableHead>
                  <TableHead className="text-right">{t("basis")}</TableHead>
                  <TableHead className="text-right">
                    {t("allocatedAmount")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {item.lineAllocations.map((la) => (
                  <TableRow key={la.id}>
                    <TableCell className="font-mono text-sm">
                      {la.purchaseOrderLineId.slice(0, 8)}...
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {la.componentId.slice(0, 8)}...
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm tabular-nums">
                      {la.allocationBasis}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm tabular-nums">
                      {formatMoney(la.allocatedAmount, item.currencyCode)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}
