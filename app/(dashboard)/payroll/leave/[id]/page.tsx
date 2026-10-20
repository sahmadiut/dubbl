"use client";

import { useTranslations } from "next-intl";
import { payrollTimeJson, payrollTimeMatch, payrollTimeOrganization, type LeaveDetail } from "@/i18n/payroll-time-presentation";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, CalendarDays, CheckCircle, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ContentReveal } from "@/components/ui/content-reveal";
import { BrandLoader } from "@/components/dashboard/brand-loader";
import { useConfirm } from "@/lib/hooks/use-confirm";
import { useDocumentTitle } from "@/lib/hooks/use-document-title";
import { cn } from "@/lib/utils";

type LeaveRequestDetail = LeaveDetail;

const statusColors: Record<string, string> = {
  pending: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300",
  approved: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  rejected: "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300",
  cancelled: "border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-300",
};

export default function LeaveRequestDetailPage() {
  const t = useTranslations("PayrollTimeDetail");
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [req, setReq] = useState<LeaveRequestDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [moneyError, setMoneyError] = useState<string | null>(null);
  const { confirm, dialog: confirmDialog } = useConfirm();

  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const [approving, setApproving] = useState(false);

  const orgId = payrollTimeOrganization();
  useDocumentTitle(t("leaveDetailTitle"));

  const fetchRequest = useCallback(async (current: () => boolean = () => true, initial = false) => {
    if (!orgId) { if (current()) setLoading(false); return; }
    try {
      const response = await fetch(`/api/v1/payroll/leave/requests/${id}`, { headers: { "x-organization-id": orgId } });
      if (response.status === 404) { if (current()) { setReq(null); setMoneyError(null); } return; }
      const data = await payrollTimeJson(response, "leaveDetail");
      payrollTimeMatch(data.request, id);
      if (current()) { setReq(data.request); setMoneyError(null); }
    } catch {
      if (current()) { if (initial) setMoneyError("loadFailed"); else toast.error(t("loadFailed")); }
    } finally { if (current()) setLoading(false); }
  }, [id, orgId, t]);

  useEffect(() => { let active = true; void fetchRequest(() => active, true); return () => { active = false; }; }, [fetchRequest]);

  async function handleApprove() {
    if (!orgId || approving || !req) return;
    if (!await confirm({
      title: t("approveTitle"),
      description: t("approveDescription", { employee: req.employee?.name || t("employee"), hours: String(req.hours), policy: req.policy?.name || t("leaveFallback") }),
      confirmLabel: t("approve"),
    })) return;
    setApproving(true);
    try {
      const data = await payrollTimeJson(await fetch(`/api/v1/payroll/leave/requests/${id}/approve`, {
        method: "POST", headers: { "x-organization-id": orgId },
      }), "approved");
      payrollTimeMatch(data.request, id);
      toast.success(t("leaveApproved"));
      void fetchRequest();
    } catch { toast.error(t("approveFailed")); }
    finally { setApproving(false); }
  }

  async function handleReject() {
    if (!orgId || rejecting) return;
    setRejecting(true);
    try {
      const data = await payrollTimeJson(await fetch(`/api/v1/payroll/leave/requests/${id}/reject`, {
        method: "POST", headers: { "Content-Type": "application/json", "x-organization-id": orgId },
        body: JSON.stringify({ reason: rejectReason.trim() || undefined }),
      }), "rejected");
      payrollTimeMatch(data.request, id);
      toast.success(t("leaveRejected"));
      setRejectOpen(false); setRejectReason("");
      void fetchRequest();
    } catch { toast.error(t("rejectFailed")); }
    finally { setRejecting(false); }
  }

  if (loading) return <BrandLoader />;
  if (moneyError) return <p role="alert">{t("loadFailed")}</p>;

  if (!req) {
    return (
      <ContentReveal>
        <button onClick={() => router.push("/payroll/leave")} className="flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground transition-colors mb-6">
          <ArrowLeft className="size-3.5" /> {t("backLeave")}
        </button>
        <p className="text-sm text-muted-foreground">{t("leaveNotFound")}</p>
      </ContentReveal>
    );
  }

  return (
    <ContentReveal className="space-y-6">
      <button onClick={() => router.push("/payroll/leave")} className="flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="size-3.5" /> {t("backLeave")}
      </button>

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-muted">
            <CalendarDays className="size-5 text-muted-foreground" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold">{req.employee?.name || t("unknown")}</h1>
              <Badge variant="outline" className={cn("text-[10px]", statusColors[req.status] || "")}>{t(req.status)}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {t("leaveSummary", { policy: req.policy?.name || "-", start: req.startDate, end: req.endDate, hours: String(req.hours) })}
            </p>
          </div>
        </div>
        {req.status === "pending" && (
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={handleApprove} disabled={approving} className="bg-emerald-600 hover:bg-emerald-700">
              <CheckCircle className="mr-1.5 size-3.5" /> {t("approve")}
            </Button>
            <Button size="sm" variant="destructive" onClick={() => setRejectOpen(true)} disabled={approving}>
              <XCircle className="mr-1.5 size-3.5" /> {t("reject")}
            </Button>
          </div>
        )}
      </div>

      {req.reason && (
        <div className="rounded-lg border bg-card px-4 py-3">
          <p className="text-xs font-medium text-muted-foreground mb-1">{t("requestReason")}</p>
          <p className="text-sm">{req.reason}</p>
        </div>
      )}

      {req.status === "rejected" && req.rejectionReason && (
        <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/20 px-4 py-3">
          <p className="text-sm text-red-600 dark:text-red-400">{t("rejectedReason", { reason: req.rejectionReason })}</p>
        </div>
      )}

      {/* Details */}
      <div className="rounded-xl border bg-card divide-y">
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-sm text-muted-foreground">{t("leaveType")}</span>
          <span className="text-sm font-medium">{req.policy?.name || "-"}</span>
        </div>
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-sm text-muted-foreground">{t("dates")}</span>
          <span className="text-sm font-medium">{t("dateRange", { start: req.startDate, end: req.endDate })}</span>
        </div>
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-sm text-muted-foreground">{t("hours")}</span>
          <span className="text-sm font-mono tabular-nums">{t("hoursValue", { hours: String(req.hours) })}</span>
        </div>
        {req.status === "approved" && req.approvedAt && (
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-sm text-muted-foreground">{t("approvedOn")}</span>
            <span className="text-sm font-medium">{new Date(req.approvedAt).toLocaleDateString()}</span>
          </div>
        )}
      </div>

      <Dialog open={rejectOpen} onOpenChange={(open) => { if (!rejecting) { setRejectOpen(open); if (!open) setRejectReason(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("rejectLeave")}</DialogTitle>
            <DialogDescription>{t("rejectLeaveDescription")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label className="text-xs">{t("reason")}</Label>
            <Textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder={t("rejectLeaveExample")}
              rows={4}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)} disabled={rejecting}>{t("cancel")}</Button>
            <Button variant="destructive" onClick={handleReject} disabled={rejecting}>
              <XCircle className="mr-1.5 size-3.5" /> {t("rejectRequest")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {confirmDialog}
    </ContentReveal>
  );
}
