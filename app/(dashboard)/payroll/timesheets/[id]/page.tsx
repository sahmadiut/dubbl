"use client";

import { useTranslations } from "next-intl";
import { payrollTimeJson, payrollTimeMatch, payrollTimeOrganization, type TimeSheetDetail } from "@/i18n/payroll-time-presentation";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "motion/react";
import { toast } from "sonner";
import { ArrowLeft, Plus, Clock, Send, CheckCircle, XCircle, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

type TimesheetDetail = TimeSheetDetail;


const statusColors: Record<string, string> = {
  draft: "",
  submitted: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300",
  approved: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  rejected: "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300",
};

const anim = (delay: number) => ({
  initial: { opacity: 0, y: 12 } as const,
  animate: { opacity: 1, y: 0 } as const,
  transition: { duration: 0.3, delay } as const,
});

export default function TimesheetDetailPage() {
  const t = useTranslations("PayrollTimeDetail");
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [ts, setTs] = useState<TimesheetDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [moneyError, setMoneyError] = useState<string | null>(null);
  const { confirm, dialog: confirmDialog } = useConfirm();

  // Reject dialog
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const [approving, setApproving] = useState(false);

  // New entry form
  const [newDate, setNewDate] = useState("");
  const [newHours, setNewHours] = useState("");
  const [newShiftType, setNewShiftType] = useState("regular");
  const [newDesc, setNewDesc] = useState("");

  const orgId = payrollTimeOrganization();
  useDocumentTitle(t("sheetDetailTitle"));

  const fetchTimesheet = useCallback(async (current: () => boolean = () => true, initial = false) => {
    if (!orgId) { if (current()) setLoading(false); return; }
    try {
      const response = await fetch(`/api/v1/payroll/timesheets/${id}`, { headers: { "x-organization-id": orgId } });
      if (response.status === 404) { if (current()) { setTs(null); setMoneyError(null); } return; }
      const data = await payrollTimeJson(response, "timesheetDetail");
      payrollTimeMatch(data.timesheet, id);
      if (current()) { setTs(data.timesheet); setMoneyError(null); }
    } catch {
      if (current()) { if (initial) setMoneyError("loadFailed"); else toast.error(t("loadFailed")); }
    } finally { if (current()) setLoading(false); }
  }, [id, orgId, t]);

  useEffect(() => { let active = true; void fetchTimesheet(() => active, true); return () => { active = false; }; }, [fetchTimesheet]);

  async function handleAddEntry() {
    if (!orgId || !newDate || !newHours) return;
    try {
      await payrollTimeJson(await fetch(`/api/v1/payroll/timesheets/${id}/entries`, {
        method: "POST", headers: { "Content-Type": "application/json", "x-organization-id": orgId },
        body: JSON.stringify({ date: newDate, hours: parseFloat(newHours), shiftType: newShiftType, description: newDesc || undefined }),
      }), "entryCreated");
      toast.success(t("entryAdded")); setNewDate(""); setNewHours(""); setNewDesc(""); void fetchTimesheet();
    } catch { toast.error(t("addFailed")); }
  }

  async function handleDeleteEntry(entryId: string) {
    if (!orgId) return;
    if (!await confirm({ title: t("deleteTitle"), description: t("deleteDescription"), confirmLabel: t("delete"), destructive: true })) return;
    try {
      await payrollTimeJson(await fetch(`/api/v1/payroll/timesheets/${id}/entries?entryId=${entryId}`, {
        method: "DELETE", headers: { "x-organization-id": orgId },
      }), "deleted");
      void fetchTimesheet();
    } catch { toast.error(t("deleteFailed")); }
  }

  async function handleSubmit() {
    if (!orgId) return;
    try {
      const data = await payrollTimeJson(await fetch(`/api/v1/payroll/timesheets/${id}/submit`, {
        method: "POST", headers: { "x-organization-id": orgId },
      }), "submitted");
      payrollTimeMatch(data.timesheet, id); toast.success(t("sheetSubmitted")); void fetchTimesheet();
    } catch { toast.error(t("submitFailed")); }
  }

  async function handleApprove() {
    if (!orgId || approving) return;
    setApproving(true);
    try {
      const data = await payrollTimeJson(await fetch(`/api/v1/payroll/timesheets/${id}/approve`, {
        method: "POST", headers: { "x-organization-id": orgId },
      }), "sheetApproved");
      payrollTimeMatch(data.timesheet, id);
      toast.success(t("sheetApproved"));
      void fetchTimesheet();
    } catch { toast.error(t("approveFailed")); }
    finally { setApproving(false); }
  }

  async function handleReject() {
    if (!orgId || rejecting) return;
    setRejecting(true);
    try {
      const data = await payrollTimeJson(await fetch(`/api/v1/payroll/timesheets/${id}/reject`, {
        method: "POST", headers: { "Content-Type": "application/json", "x-organization-id": orgId },
        body: JSON.stringify({ reason: rejectReason.trim() || undefined }),
      }), "sheetRejected");
      payrollTimeMatch(data.timesheet, id);
      toast.success(t("sheetRejected"));
      setRejectOpen(false); setRejectReason("");
      void fetchTimesheet();
    } catch { toast.error(t("rejectFailed")); }
    finally { setRejecting(false); }
  }

  if (loading) return <BrandLoader />;
  if (moneyError) return <p role="alert">{t("loadFailed")}</p>;

  if (!ts) {
    return (
      <ContentReveal>
        <button onClick={() => router.push("/payroll/timesheets")} className="flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground transition-colors mb-6">
          <ArrowLeft className="size-3.5" /> {t("backSheets")}
        </button>
        <p className="text-sm text-muted-foreground">{t("sheetNotFound")}</p>
      </ContentReveal>
    );
  }

  return (
    <ContentReveal className="space-y-6">
      <button onClick={() => router.push("/payroll/timesheets")} className="flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="size-3.5" /> {t("backSheets")}
      </button>

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-muted">
            <Clock className="size-5 text-muted-foreground" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold">{ts.employee?.name || t("unknown")}</h1>
              <Badge variant="outline" className={statusColors[ts.status] || ""}>{t(ts.status)}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">{t("sheetSummary", { start: ts.periodStart, end: ts.periodEnd, hours: String(ts.totalHours) })}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {ts.status === "draft" && (
            <Button size="sm" onClick={handleSubmit} className="bg-blue-600 hover:bg-blue-700">
              <Send className="mr-1.5 size-3.5" /> {t("submit")}
            </Button>
          )}
          {ts.status === "submitted" && (
            <>
              <Button size="sm" onClick={handleApprove} disabled={approving} className="bg-emerald-600 hover:bg-emerald-700">
                <CheckCircle className="mr-1.5 size-3.5" /> {t("approve")}
              </Button>
              <Button size="sm" variant="destructive" onClick={() => setRejectOpen(true)}>
                <XCircle className="mr-1.5 size-3.5" /> {t("reject")}
              </Button>
            </>
          )}
        </div>
      </div>

      {ts.rejectionReason && (
        <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/20 px-4 py-3">
          <p className="text-sm text-red-600 dark:text-red-400">{t("rejectedReason", { reason: ts.rejectionReason })}</p>
        </div>
      )}

      {/* Entries */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">{t("entries", { count: String(ts.entries.length) })}</h3>

        {ts.status === "draft" && (
          <motion.div {...anim(0)} className="rounded-lg border p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="space-y-1">
                <Label className="text-xs">{t("date")}</Label>
                <Input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} className="h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t("hours")}</Label>
                <Input type="number" step="0.25" value={newHours} onChange={(e) => setNewHours(e.target.value)} className="h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t("type")}</Label>
                <Select value={newShiftType} onValueChange={setNewShiftType}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="regular">{t("regular")}</SelectItem>
                    <SelectItem value="overtime">{t("overtime")}</SelectItem>
                    <SelectItem value="night">{t("night")}</SelectItem>
                    <SelectItem value="weekend">{t("weekend")}</SelectItem>
                    <SelectItem value="holiday">{t("holiday")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t("description")}</Label>
                <Input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} className="h-8 text-sm" placeholder={t("optional")} />
              </div>
            </div>
            <Button size="sm" onClick={handleAddEntry} disabled={!newDate || !newHours}>
              <Plus className="mr-1.5 size-3" /> {t("addEntry")}
            </Button>
          </motion.div>
        )}

        {(ts.entries || []).length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">{t("noEntries")}</div>
        ) : (
          <div className="rounded-xl border bg-card divide-y">
            {(ts.entries || []).map((entry) => (
              <div key={entry.id} className="flex items-center justify-between px-4 py-2.5">
                <div>
                  <p className="text-sm font-medium">{entry.date}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge variant="outline" className="text-[10px]">{t(entry.shiftType)}</Badge>
                    {entry.description && <span className="text-xs text-muted-foreground">{entry.description}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-mono tabular-nums">{t("hoursValue", { hours: String(entry.hours) })}</span>
                  {ts.status === "draft" && (
                    <Button size="icon" variant="ghost" className="size-7" aria-label={t("delete")} onClick={() => handleDeleteEntry(entry.id)}>
                      <Trash2 className="size-3.5 text-muted-foreground" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={rejectOpen} onOpenChange={(open) => { if (!rejecting) { setRejectOpen(open); if (!open) setRejectReason(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("rejectSheet")}</DialogTitle>
            <DialogDescription>{t("rejectSheetDescription")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label className="text-xs">{t("reason")}</Label>
            <Textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder={t("rejectSheetExample")}
              rows={4}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)} disabled={rejecting}>{t("cancel")}</Button>
            <Button variant="destructive" onClick={handleReject} disabled={rejecting}>
              <XCircle className="mr-1.5 size-3.5" /> {t("rejectSheet")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {confirmDialog}
    </ContentReveal>
  );
}
