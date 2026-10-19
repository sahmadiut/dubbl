"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { requisitionStatusLabel } from "@/i18n/requisition-presentation";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  Send,
  Check,
  X,
  FileText,
  AlertCircle,
} from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { procurementDocument, procurementMoney } from "@/lib/money/procurement-ui";
import type { ProcurementWire } from "@/lib/money/procurement-ui";
import { ProcurementMoneyDetails } from "@/components/dashboard/procurement-money-details";
import { useDocumentTitle } from "@/lib/hooks/use-document-title";
import { useEntityTitle } from "@/lib/hooks/use-entity-title";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import Link from "next/link";

interface RequisitionDetail {
  currencyCode: string;
  id: string;
  requisitionNumber: string;
  requestDate: string;
  requiredDate: string | null;
  status: string;
  reference: string | null;
  notes: string | null;
  subtotal: bigint;
  taxTotal: bigint;
  total: bigint;
  rejectionReason: string | null;
  convertedPoId: string | null;
  contact: { name: string } | null;
  lines: {
    id: string;
    description: string;
    quantity: number;
    unitPrice: bigint;
    taxAmount: bigint;
    amount: bigint;
    account: { code: string; name: string } | null;
  }[];
}

const statusColors: Record<string, string> = {
  draft: "",
  submitted:
    "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300",
  approved:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  rejected:
    "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300",
  converted:
    "border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-800 dark:bg-purple-950 dark:text-purple-300",
};

export default function RequisitionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const orgId = typeof window !== "undefined" ? localStorage.getItem("activeOrgId") : null;
  return <RequisitionDetailContent key={`${orgId}:${id}`} />;
}

function RequisitionDetailContent() {
  const t = useTranslations("Requisitions");
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [req, setReq] = useState<RequisitionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [readError, setReadError] = useState<"detailReadFailed" | null>(null);
  const [rejectSheetOpen, setRejectSheetOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [acting, setActing] = useState(false);
  useDocumentTitle(t("detailTitle"));
  useEntityTitle(req?.requisitionNumber);
  const orgId =
    typeof window !== "undefined"
      ? localStorage.getItem("activeOrgId")
      : null;

  useEffect(() => {
    if (!orgId) return;
    const controller = new AbortController();
    fetch(`/api/v1/purchase-requisitions/${id}`, { headers: { "x-organization-id": orgId }, signal: controller.signal })
      .then(r => { if (!r.ok) throw new Error("Could not load procurement document"); return r.json(); })
      .then(data => { if (!controller.signal.aborted) setReq(procurementDocument(data as ProcurementWire<RequisitionDetail>)); })
      .catch(() => { if (!controller.signal.aborted) { setReq(null); setReadError("detailReadFailed"); } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [id, orgId]);

  async function handleSubmit() {
    if (!orgId || !req || acting) return;
    setActing(true);
    try {
      const submitRes = await fetch(`/api/v1/purchase-requisitions/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-organization-id": orgId,
        },
        body: JSON.stringify({ status: "submitted" }),
      });
      if (submitRes.ok) {
        const data = await submitRes.json();
        if (data?.status !== "submitted") throw new Error("Invalid submit response");
        setReq((prev) => (prev ? { ...prev, status: data.status } : prev));
        toast.success(t("submitSuccess"));
      } else {
        toast.error(t("submitFailed"));
      }
    } catch {
      toast.error(t("submitFailed"));
    } finally {
      setActing(false);
    }
  }

  async function handleApprove() {
    if (!orgId || acting) return;
    setActing(true);
    try {
      const res = await fetch(
        `/api/v1/purchase-requisitions/${id}/approve`,
        {
          method: "POST",
          headers: { "x-organization-id": orgId },
        }
      );
      if (res.ok) {
        const data = await res.json();
        if (data?.status !== "approved") throw new Error("Invalid approval response");
        setReq((prev) =>
          prev ? { ...prev, status: "approved" } : prev
        );
        toast.success(t("approveSuccess"));
      } else {
        toast.error(t("approveFailed"));
      }
    } catch {
      toast.error(t("approveFailed"));
    } finally {
      setActing(false);
    }
  }

  async function handleReject() {
    if (!orgId || acting) return;
    setActing(true);
    try {
      const res = await fetch(
        `/api/v1/purchase-requisitions/${id}/reject`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-organization-id": orgId,
          },
          body: JSON.stringify({ reason: rejectReason || undefined }),
        }
      );
      if (res.ok) {
        const data = await res.json();
        if (data?.status !== "rejected") throw new Error("Invalid rejection response");
        setReq((prev) =>
          prev
            ? {
                ...prev,
                status: "rejected",
                rejectionReason: rejectReason || null,
              }
            : prev
        );
        setRejectSheetOpen(false);
        setRejectReason("");
        toast.success(t("rejectSuccess"));
      } else {
        toast.error(t("rejectFailed"));
      }
    } catch {
      toast.error(t("rejectFailed"));
    } finally {
      setActing(false);
    }
  }

  async function handleConvert() {
    if (!orgId || acting) return;
    setActing(true);
    try {
      const res = await fetch(
        `/api/v1/purchase-requisitions/${id}/convert`,
        {
          method: "POST",
          headers: { "x-organization-id": orgId },
        }
      );
      if (res.ok) {
        const data = await res.json();
        if (typeof data?.purchaseOrder?.id !== "string" || !data.purchaseOrder.id.trim()) throw new Error("Invalid purchase order response");
        toast.success(t("convertSuccess"));
        router.push(`/purchases/orders/${data.purchaseOrder.id}`);
      } else {
        toast.error(t("convertFailed"));
      }
    } catch {
      toast.error(t("convertFailed"));
    } finally {
      setActing(false);
    }
  }

  if (readError) return <p role="alert" className="text-sm text-red-600">{t(readError)}</p>;
  if (loading)
    return (
      <div className="space-y-6">
        <PageHeader title={t("loading")} />
      </div>
    );
  if (!req)
    return (
      <div className="space-y-6">
        <PageHeader title={t("notFound")} />
      </div>
    );

  return (
    <div className="space-y-6">
      <PageHeader
        title={req.requisitionNumber}
        description={t("supplierName", { name: req.contact?.name || t("notAssigned") })}
      >
        <Button variant="outline" size="sm" asChild>
          <Link href="/purchases/requisitions">
            <ArrowLeft className="mr-2 size-4" />
            {t("back")}
          </Link>
        </Button>
        {req.status === "draft" && (
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={acting}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            <Send className="mr-2 size-4" />
            {t("submit")}
          </Button>
        )}
        {req.status === "submitted" && (
          <>
            <Button
              size="sm"
              onClick={handleApprove}
              disabled={acting}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              <Check className="mr-2 size-4" />
              {t("approve")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setRejectSheetOpen(true)}
              disabled={acting}
              className="text-red-600"
            >
              <X className="mr-2 size-4" />
              {t("reject")}
            </Button>
          </>
        )}
        {req.status === "approved" && (
          <Button
            size="sm"
            onClick={handleConvert}
            disabled={acting}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            <FileText className="mr-2 size-4" />
            {t("createOrder")}
          </Button>
        )}
      </PageHeader>

      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <Badge
          variant="outline"
          className={statusColors[req.status] || ""}
        >
          {requisitionStatusLabel(t, req.status)}
        </Badge>
        <span className="text-xs sm:text-sm text-muted-foreground">
          {t("requested", { date: req.requestDate })}
          {req.requiredDate ? t("requiredDate", { date: req.requiredDate }) : ""}
        </span>
      </div>

      {/* Rejection reason */}
      {req.status === "rejected" && req.rejectionReason && (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/30">
          <AlertCircle className="size-5 shrink-0 text-red-600 dark:text-red-400 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-800 dark:text-red-300">
              {t("rejectionReason")}
            </p>
            <p className="text-sm text-red-700 dark:text-red-400 mt-1">
              {req.rejectionReason}
            </p>
          </div>
        </div>
      )}

      {/* Converted PO link */}
      {req.status === "converted" && req.convertedPoId && (
        <div className="flex items-center gap-2 rounded-lg border border-purple-200 bg-purple-50 p-4 dark:border-purple-900 dark:bg-purple-950/30">
          <FileText className="size-5 text-purple-600 dark:text-purple-400" />
          <p className="text-sm text-purple-800 dark:text-purple-300">
            {t("convertedNotice")}
          </p>
          <Button variant="link" size="sm" asChild className="text-purple-700 dark:text-purple-300">
            <Link href={`/purchases/orders/${req.convertedPoId}`}>
              {t("viewOrder")}
            </Link>
          </Button>
        </div>
      )}

      {/* Reference and notes */}
      {(req.reference || req.notes) && (
        <div className="grid gap-4 sm:grid-cols-2">
          {req.reference && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">{t("reference")}</p>
              <p className="text-sm">{req.reference}</p>
            </div>
          )}
          {req.notes && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">{t("notes")}</p>
              <p className="text-sm">{req.notes}</p>
            </div>
          )}
        </div>
      )}

      {/* Total */}
      <div className="rounded-lg border p-4">
        <p className="text-xl font-bold font-mono break-all">
          {procurementMoney(req.total, req.currencyCode)}
        </p>
      </div>

      <ProcurementMoneyDetails document={req} />

      {/* Reject drawer */}
      <Sheet open={rejectSheetOpen} onOpenChange={setRejectSheetOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{t("rejectRequisition")}</SheetTitle>
          </SheetHeader>
          <div className="px-4 pb-6 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">{t("optionalReason")}</Label>
              <Textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder={t("reasonPlaceholder")}
                rows={3}
              />
            </div>
            <Button
              onClick={handleReject}
              disabled={acting}
              className="w-full bg-red-600 hover:bg-red-700"
            >
              <X className="mr-2 size-4" />
              {t("rejectRequisition")}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
