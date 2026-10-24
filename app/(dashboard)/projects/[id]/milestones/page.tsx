"use client";
import { currencyLabel } from "@/i18n/currency-labels";
import { usePresentation as useUnitPresentation } from "@/i18n/provider";

import { projectMilestoneJson, milestoneAssignmentsJson, milestoneBillingJson, milestoneInvoiceJson, type MilestoneAssignment, type MilestoneBilling } from "@/i18n/project-milestones-presentation";
import { useTranslations } from "next-intl";
import { usePresentation } from "@/i18n/provider";
import { formatDateOnly } from "@/i18n/dates";

import { projectBillingFixedCents, projectBillingPercent } from "@/lib/money/project-billing-display";
import { projectCentsInput } from "@/lib/money/project-display";

import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { Plus, Trash2, CheckCircle2, Flag, Target, Loader2, Users, DollarSign, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { projectMoneyDisplay } from "@/lib/money/project-display";
import { useProject, pct } from "../project-context";
import { useDocumentTitle } from "@/lib/hooks/use-document-title";

export default function MilestonesPage() {
  const unitPresentation = useUnitPresentation();
  const t = useTranslations("ProjectMilestones");
  const presentation = usePresentation();
  const formatDateShort = (value: string) => formatDateOnly(value, presentation, { month: "short", day: "numeric" });
  const { project: proj, orgId, projectId, refresh } = useProject();
  const formatMoney = (amount: number | bigint | string) => projectMoneyDisplay(amount, proj?.currency ?? "USD", unitPresentation);
  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [amount, setAmount] = useState("");
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [assignMilestoneId, setAssignMilestoneId] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<MilestoneAssignment[]>([]);
  const [loadingAssignments, setLoadingAssignments] = useState(false);
  const [assignMemberId, setAssignMemberId] = useState("none");
  const [assignAmount, setAssignAmount] = useState("");
  const [assignDesc, setAssignDesc] = useState("");
  const [assignSaving, setAssignSaving] = useState(false);

  // Progress invoice state
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [invoiceSaving, setInvoiceSaving] = useState(false);
  const [selectedMilestoneIds, setSelectedMilestoneIds] = useState<string[]>([]);
  const [selectedTimeEntryIds, setSelectedTimeEntryIds] = useState<string[]>([]);
  const [fixedPercent, setFixedPercent] = useState("");
  const [invoiceNotes, setInvoiceNotes] = useState("");
  const [uninvoicedData, setUninvoicedData] = useState<MilestoneBilling | null>(null);
  useDocumentTitle(t("documentTitle"));

  useEffect(() => {
    if (!assignMilestoneId || !orgId) return;
    let active = true;
    setLoadingAssignments(true);
    fetch(`/api/v1/projects/${projectId}/milestones/${assignMilestoneId}/assignments`, {
      headers: { "x-organization-id": orgId },
    })
      .then(milestoneAssignmentsJson)
      .then(data => { if (active) setAssignments(data.assignments); })
      .catch(() => { if (active) { setAssignments([]); toast.error(t("assignmentsLoadFailed")); } })
      .finally(() => { if (active) setLoadingAssignments(false); });
    return () => { active = false; };
  }, [assignMilestoneId, orgId, projectId, t]);

  // Fetch uninvoiced data when invoice sheet opens.
  useEffect(() => {
    if (!invoiceOpen || !orgId || !proj) return;
    let active = true;
    setInvoiceLoading(true);
    setUninvoicedData(null);
    setSelectedMilestoneIds([]);
    setSelectedTimeEntryIds([]);
    setFixedPercent("");
    setInvoiceNotes("");
    fetch(`/api/v1/projects/${projectId}/progress-invoice`, {
      headers: { "x-organization-id": orgId },
    })
      .then(r => milestoneBillingJson(r, proj.billingType, proj.currency))
      .then(data => { if (active) setUninvoicedData(data); })
      .catch(() => { if (active) toast.error(t("billingPreviewFailed")); })
      .finally(() => { if (active) setInvoiceLoading(false); });
    return () => { active = false; };
  }, [invoiceOpen, orgId, projectId, proj, t]);

  // Calculate invoice preview total (must be before early returns)
  const invoicePreviewTotal = useMemo(() => {
    if (!uninvoicedData || !proj) return 0n;
    if (uninvoicedData.billingType === "milestone") {
      return (uninvoicedData.milestones || [])
        .filter((m) => selectedMilestoneIds.includes(m.id))
        .reduce((s, m) => s + BigInt(m.remaining), 0n);
    }
    if (uninvoicedData.billingType === "hourly") {
      return (uninvoicedData.timeEntries || [])
        .filter((e) => selectedTimeEntryIds.includes(e.id))
        .reduce((s, e) => s + BigInt(e.amount), 0n);
    }
    if (uninvoicedData.billingType === "fixed") {
      try { return projectBillingFixedCents(proj.fixedPrice, fixedPercent); } catch { return 0n; }
    }
    return 0n;
  }, [uninvoicedData, selectedMilestoneIds, selectedTimeEntryIds, fixedPercent, proj]);

  if (!proj) return null;

  const milestones = proj.milestones;
  const completed = milestones.filter(m => m.status === "completed").length;
  const total = milestones.length;
  const totalAmount = milestones.reduce((s, m) => s + BigInt(m.amount), 0n);
  const completedAmount = milestones.filter(m => m.status === "completed").reduce((s, m) => s + BigInt(m.amount), 0n);
  const totalInvoiced = milestones.reduce((s, m) => s + BigInt(m.invoicedAmountCents), 0n);

  async function handleAdd() {
    if (!orgId || !title.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/milestones`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-organization-id": orgId },
        body: JSON.stringify({ title: title.trim(), description: desc || null, dueDate: dueDate || null, amountMinor: projectCentsInput(amount || "0") }),
      });
      await projectMilestoneJson(res);
      toast.success(t("milestoneCreated"));
      setAddOpen(false);
      setTitle(""); setDesc(""); setDueDate(""); setAmount("");
      refresh();
    } catch { toast.error(t("milestoneCreateFailed")); }
    finally { setSaving(false); }
  }

  async function toggleComplete(ms: typeof milestones[0]) {
    if (!orgId || togglingId) return;
    setTogglingId(ms.id);
    try {
      const newStatus = ms.status === "completed" ? "upcoming" : "completed";
      const res = await fetch(`/api/v1/projects/${projectId}/milestones/${ms.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-organization-id": orgId },
        body: JSON.stringify({ status: newStatus }),
      });
      await projectMilestoneJson(res, "milestone", ms.id);
      refresh();
    } catch { toast.error(t("milestoneUpdateFailed")); }
    finally { setTogglingId(null); }
  }

  async function deleteMilestone(msId: string) {
    if (!orgId || deletingId) return;
    setDeletingId(msId);
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/milestones/${msId}`, { method: "DELETE", headers: { "x-organization-id": orgId } });
      await projectMilestoneJson(res, "delete");
      refresh();
    } catch { toast.error(t("milestoneDeleteFailed")); }
    finally { setDeletingId(null); }
  }

  const members = proj.members;

  async function handleAddAssignment() {
    if (!orgId || !assignMilestoneId || assignMemberId === "none") return;
    setAssignSaving(true);
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/milestones/${assignMilestoneId}/assignments`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-organization-id": orgId },
        body: JSON.stringify({
          memberId: assignMemberId,
          amountMinor: projectCentsInput(assignAmount || "0"),
          description: assignDesc || null,
        }),
      });
      await projectMilestoneJson(res, "assignment");
      toast.success(t("assignmentAdded"));
      setAssignMemberId("none"); setAssignAmount(""); setAssignDesc("");
      // Refresh assignments
      const r = await fetch(`/api/v1/projects/${projectId}/milestones/${assignMilestoneId}/assignments`, {
        headers: { "x-organization-id": orgId },
      });
      const data = await milestoneAssignmentsJson(r);
      setAssignments(data.assignments);
    } catch { toast.error(t("assignmentAddFailed")); }
    finally { setAssignSaving(false); }
  }

  async function markAssignmentPaid(assignmentId: string) {
    if (!orgId || !assignMilestoneId) return;
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/milestones/${assignMilestoneId}/assignments?assignmentId=${assignmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-organization-id": orgId },
      });
      await projectMilestoneJson(res, "assignment", assignmentId);
      toast.success(t("markedPaid"));
      const r = await fetch(`/api/v1/projects/${projectId}/milestones/${assignMilestoneId}/assignments`, {
        headers: { "x-organization-id": orgId },
      });
      const data = await milestoneAssignmentsJson(r);
      setAssignments(data.assignments);
    } catch { toast.error(t("assignmentUpdateFailed")); }
  }

  async function handleCreateInvoice() {
    if (!orgId || !proj || invoicePreviewTotal <= 0) return;
    setInvoiceSaving(true);
    try {
      const body: Record<string, unknown> = { notes: invoiceNotes || undefined };
      if (proj.billingType === "milestone") {
        body.milestoneIds = selectedMilestoneIds;
      } else if (proj.billingType === "hourly") {
        body.timeEntryIds = selectedTimeEntryIds;
      } else if (proj.billingType === "fixed") {
        body.percentageToInvoice = projectBillingPercent(fixedPercent).percent;
      }

      const res = await fetch(`/api/v1/projects/${projectId}/progress-invoice`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-organization-id": orgId },
        body: JSON.stringify(body),
      });

      const data = await milestoneInvoiceJson(res);
      toast.success(t("invoiceCreated", { number: data.invoice.invoiceNumber }));
      setInvoiceOpen(false);
      refresh();
    } catch {
      toast.error(t("invoiceCreateFailed"));
    } finally {
      setInvoiceSaving(false);
    }
  }

  function toggleMilestoneSelection(id: string) {
    setSelectedMilestoneIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }

  function toggleTimeEntrySelection(id: string) {
    setSelectedTimeEntryIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }

  const isBillable = proj.billingType !== "non_billable";

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className={cn("grid gap-2 sm:gap-3 grid-cols-1", isBillable ? "sm:grid-cols-4" : "sm:grid-cols-3")}>
        <div className="rounded-lg border bg-card p-3">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{t("progress")}</p>
          <p className="text-lg font-bold font-mono tabular-nums mt-0.5">{completed}/{total}</p>
          {total > 0 && (
            <div className="h-1.5 rounded-full bg-muted overflow-hidden mt-2">
              <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pct(completed, total)}%` }} />
            </div>
          )}
        </div>
        <div className="rounded-lg border bg-card p-3">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{t("totalValue")}</p>
          <p className="text-lg font-bold font-mono tabular-nums mt-0.5">{formatMoney(totalAmount)}</p>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{t("completedValue")}</p>
          <p className="text-lg font-bold font-mono tabular-nums text-emerald-600 mt-0.5">{formatMoney(completedAmount)}</p>
        </div>
        {isBillable && (
          <div className="rounded-lg border bg-card p-3">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{t("invoiced")}</p>
            <p className="text-lg font-bold font-mono tabular-nums text-blue-600 mt-0.5">{formatMoney(totalInvoiced)}</p>
            {totalAmount > 0 && (
              <div className="h-1.5 rounded-full bg-muted overflow-hidden mt-2">
                <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${pct(totalInvoiced, totalAmount)}%` }} />
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2">
        {isBillable && (
          <Button size="sm" variant="outline" className="h-8" onClick={() => setInvoiceOpen(true)}>
            <FileText className="size-3.5" />{t("createInvoice")}
          </Button>
        )}
        <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 h-8" onClick={() => setAddOpen(true)}>
          <Plus className="size-3.5" />{t("milestone")}
        </Button>
      </div>

      {/* Add Milestone Drawer */}
      <Sheet open={addOpen} onOpenChange={setAddOpen}>
        <SheetContent className="sm:max-w-xl w-full p-0 flex flex-col">
          <SheetHeader className="px-6 pt-6 pb-4 border-b space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
                <Target className="size-5" />
              </div>
              <div>
                <SheetTitle className="text-lg">{t("newMilestone")}</SheetTitle>
                <SheetDescription>{t("milestoneDescription")}</SheetDescription>
              </div>
            </div>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto space-y-6 px-6 py-5">
            <div className="space-y-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t("details")}</p>
              <div className="space-y-2">
                <Label>{t("titleRequired")}</Label>
                <Input value={title} onChange={e => setTitle(e.target.value)} placeholder={t("titlePlaceholder")} />
              </div>
              <div className="space-y-2">
                <Label>{t("description")}</Label>
                <Textarea value={desc} onChange={e => setDesc(e.target.value)} placeholder={t("descriptionPlaceholder")} rows={3} />
              </div>
            </div>

            <div className="h-px bg-border" />

            <div className="space-y-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t("scheduleValue")}</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>{t("dueDate")}</Label>
                  <DatePicker value={dueDate} onChange={setDueDate} placeholder={t("dueDatePlaceholder")} />
                </div>
                <div className="space-y-2">
                  <Label>{t("amount")}</Label>
                  <CurrencyInput prefix={proj?.currency === "USD" ? currencyLabel("USD", unitPresentation.locale, "$") : proj?.currency} value={amount} onChange={setAmount} />
                </div>
              </div>
            </div>
          </div>
          <div className="sticky bottom-0 z-10 flex items-center justify-end gap-3 border-t bg-background/80 px-6 py-4 backdrop-blur-sm">
            <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>{t("cancel")}</Button>
            <Button onClick={handleAdd} disabled={saving || !title.trim()} className="bg-emerald-600 hover:bg-emerald-700">
              {saving ? t("creating") : t("createMilestone")}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {milestones.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center min-h-[30vh] flex flex-col items-center justify-center">
          <Flag className="mx-auto size-8 text-muted-foreground/30" />
          <p className="mt-2 text-sm text-muted-foreground">{t("noMilestones")}</p>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden divide-y">
          {milestones.map((ms) => {
            const overdue = ms.dueDate && new Date(ms.dueDate) < new Date() && ms.status !== "completed";
            return (
              <div key={ms.id} className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-3 hover:bg-muted/20 transition-colors group">
                <button aria-label={t(ms.status === "completed" ? "markUpcoming" : "markComplete")} onClick={() => toggleComplete(ms)} disabled={togglingId === ms.id} className="shrink-0">
                  {togglingId === ms.id ? (
                    <Loader2 className="size-5 text-muted-foreground/40 animate-spin" />
                  ) : ms.status === "completed" ? (
                    <CheckCircle2 className="size-5 text-emerald-500" />
                  ) : (
                    <Target className="size-5 text-muted-foreground/40 hover:text-emerald-400 transition-colors" />
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <span className={cn("text-[13px] font-medium", ms.status === "completed" && "line-through text-muted-foreground")}>{ms.title}</span>
                  {ms.description && <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{ms.description}</p>}
                </div>
                {ms.dueDate && (
                  <span className={cn("text-[11px] tabular-nums shrink-0", overdue ? "text-red-600 font-medium" : "text-muted-foreground")}>{formatDateShort(ms.dueDate)}</span>
                )}
                {ms.amount > 0 && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[11px] font-mono text-muted-foreground">{formatMoney(ms.amount)}</span>
                    {ms.invoicedAmountCents > 0 && ms.invoicedAmountCents >= ms.amount && (
                      <Badge variant="outline" className="text-[9px] h-4 bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800">{t("invoiced")}</Badge>
                    )}
                    {ms.invoicedAmountCents > 0 && ms.invoicedAmountCents < ms.amount && (
                      <Badge variant="outline" className="text-[9px] h-4 bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800">{t("partial")}</Badge>
                    )}
                  </div>
                )}
                <button onClick={() => { setAssignMilestoneId(ms.id); setAssignments([]); }} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-emerald-600 transition-opacity" title={t("manageAssignments")}>
                  <Users className="size-3" />
                </button>
                <button aria-label={t("deleteMilestone")} onClick={() => deleteMilestone(ms.id)} disabled={deletingId === ms.id} className={cn("opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-600 transition-opacity", deletingId === ms.id && "opacity-100 pointer-events-none")}>
                  {deletingId === ms.id ? <Loader2 className="size-3 animate-spin" /> : <Trash2 className="size-3" />}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Assignments Sheet */}
      <Sheet open={!!assignMilestoneId} onOpenChange={open => { if (!open) { setAssignMilestoneId(null); setAssignments([]); } }}>
        <SheetContent className="sm:max-w-xl w-full p-0 flex flex-col">
          <SheetHeader className="px-6 pt-6 pb-4 border-b space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
                <Users className="size-5" />
              </div>
              <div>
                <SheetTitle className="text-lg">{t("manageAssignments")}</SheetTitle>
                <SheetDescription>{t("assignmentsDescription")}</SheetDescription>
              </div>
            </div>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto space-y-6 px-6 py-5">
            {/* Existing Assignments */}
            <div className="space-y-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t("currentAssignments")}</p>
              {loadingAssignments ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="size-5 animate-spin text-muted-foreground" />
                </div>
              ) : assignments.length === 0 ? (
                <p className="text-[12px] text-muted-foreground py-3">{t("noAssignments")}</p>
              ) : (
                <div className="rounded-lg border divide-y">
                  {assignments.map((a) => (
                    <div key={a.id} className="px-4 py-3 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium truncate">{a.member?.user?.name || a.member?.user?.email || t("member")}</p>
                        {a.description && <p className="text-[11px] text-muted-foreground truncate">{a.description}</p>}
                      </div>
                      <span className="text-[11px] font-mono text-muted-foreground shrink-0">{formatMoney(a.amount)}</span>
                      {a.isPaid ? (
                        <Badge variant="outline" className="text-[9px] h-4 bg-emerald-50 text-emerald-700 border-emerald-200">{t("paid")}</Badge>
                      ) : (
                        <Button size="sm" variant="outline" className="h-6 text-[10px] px-2" onClick={() => markAssignmentPaid(a.id)}>
                          <DollarSign className="size-3 mr-1" />{t("markPaid")}
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="h-px bg-border" />

            {/* Add Assignment Form */}
            <div className="space-y-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t("addAssignment")}</p>
              <div className="space-y-2">
                <Label>{t("member")}</Label>
                <Select value={assignMemberId} onValueChange={setAssignMemberId}>
                  <SelectTrigger><SelectValue placeholder={t("memberPlaceholder")} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none" disabled>{t("memberPlaceholder")}</SelectItem>
                    {members.map(m => (
                      <SelectItem key={m.member.id} value={m.member.id}>{m.member.user.name || m.member.user.email}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>{t("amount")}</Label>
                  <CurrencyInput prefix={proj?.currency === "USD" ? currencyLabel("USD", unitPresentation.locale, "$") : proj?.currency} value={assignAmount} onChange={setAssignAmount} />
                </div>
                <div className="space-y-2">
                  <Label>{t("description")}</Label>
                  <Input value={assignDesc} onChange={e => setAssignDesc(e.target.value)} placeholder={t("notePlaceholder")} />
                </div>
              </div>
            </div>
          </div>
          <div className="sticky bottom-0 z-10 flex items-center justify-end gap-3 border-t bg-background/80 px-6 py-4 backdrop-blur-sm">
            <Button type="button" variant="outline" onClick={() => setAssignMilestoneId(null)}>{t("close")}</Button>
            <Button onClick={handleAddAssignment} disabled={assignSaving || assignMemberId === "none"} className="bg-emerald-600 hover:bg-emerald-700">
              {assignSaving ? t("adding") : t("addAssignment")}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Progress Invoice Sheet */}
      <Sheet open={invoiceOpen} onOpenChange={setInvoiceOpen}>
        <SheetContent className="sm:max-w-xl w-full p-0 flex flex-col">
          <SheetHeader className="px-6 pt-6 pb-4 border-b space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
                <FileText className="size-5" />
              </div>
              <div>
                <SheetTitle className="text-lg">{t("progressInvoice")}</SheetTitle>
                <SheetDescription>{t("invoiceDescription")}</SheetDescription>
              </div>
            </div>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto space-y-6 px-6 py-5">
            {invoiceLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : uninvoicedData ? (
              <>
                {/* Milestone billing */}
                {uninvoicedData.billingType === "milestone" && (
                  <div className="space-y-4">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t("selectMilestones")}</p>
                    {(uninvoicedData.milestones ?? []).length > 0 ? (
                      <div className="rounded-lg border divide-y">
                        {(uninvoicedData.milestones ?? []).map((m) => {
                          const hasRemaining = m.remaining > 0;
                          return (
                            <label
                              key={m.id}
                              className={cn(
                                "flex items-center gap-3 px-4 py-3 transition-colors",
                                hasRemaining ? "cursor-pointer hover:bg-muted/20" : "opacity-50"
                              )}
                            >
                              <Checkbox
                                checked={selectedMilestoneIds.includes(m.id)}
                                onCheckedChange={() => hasRemaining && toggleMilestoneSelection(m.id)}
                                disabled={!hasRemaining}
                              />
                              <div className="flex-1 min-w-0">
                                <p className="text-[13px] font-medium truncate">{m.title}</p>
                                <p className="text-[11px] text-muted-foreground">
                                  {t("milestoneBilling", { total: formatMoney(m.amount), invoiced: formatMoney(m.invoicedAmountCents) })}
                                </p>
                              </div>
                              <div className="text-right shrink-0">
                                <p className={cn("text-[13px] font-mono tabular-nums font-medium", hasRemaining ? "text-foreground" : "text-muted-foreground")}>
                                  {formatMoney(m.remaining)}
                                </p>
                                <p className="text-[10px] text-muted-foreground">{t("remainingLower")}</p>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-[12px] text-muted-foreground py-3">{t("allInvoiced")}</p>
                    )}
                  </div>
                )}

                {/* Hourly billing */}
                {uninvoicedData.billingType === "hourly" && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t("uninvoicedTime")}</p>
                      {(uninvoicedData.timeEntries ?? []).length > 0 && (
                        <button
                          className="text-[11px] text-blue-600 hover:underline font-medium"
                          onClick={() => {
                            const allIds = (uninvoicedData.timeEntries ?? []).map((e) => e.id);
                            setSelectedTimeEntryIds(prev =>
                              prev.length === allIds.length ? [] : allIds
                            );
                          }}
                        >
                          {selectedTimeEntryIds.length === (uninvoicedData.timeEntries ?? []).length ? t("deselectAll") : t("selectAll")}
                        </button>
                      )}
                    </div>
                    {(uninvoicedData.timeEntries ?? []).length > 0 ? (
                      <div className="rounded-lg border divide-y max-h-[400px] overflow-y-auto">
                        {(uninvoicedData.timeEntries ?? []).map((e) => (
                          <label key={e.id} className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-muted/20 transition-colors">
                            <Checkbox
                              checked={selectedTimeEntryIds.includes(e.id)}
                              onCheckedChange={() => toggleTimeEntrySelection(e.id)}
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-[13px] truncate">{e.description || t("timeEntry")}</p>
                              <p className="text-[11px] text-muted-foreground">
                                {t("timeBilling", { date: formatDateShort(e.date), hours: Math.round((e.minutes / 60) * 100) / 100, rate: formatMoney(e.hourlyRate) })}
                              </p>
                            </div>
                            <span className="text-[13px] font-mono tabular-nums font-medium shrink-0">
                              {formatMoney(e.amount)}
                            </span>
                          </label>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[12px] text-muted-foreground py-3">{t("noUninvoicedTime")}</p>
                    )}
                  </div>
                )}

                {/* Fixed billing */}
                {uninvoicedData.billingType === "fixed" && (
                  <div className="space-y-4">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t("fixedProgress")}</p>
                    <div className="rounded-lg border p-4 space-y-3">
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-[13px]">
                          <span className="text-muted-foreground">{t("fixedPrice")}</span>
                          <span className="font-mono tabular-nums font-medium">{formatMoney(uninvoicedData.fixedPrice ?? 0)}</span>
                        </div>
                        <div className="flex items-center justify-between text-[13px]">
                          <span className="text-muted-foreground">{t("alreadyInvoiced")}</span>
                          <span className="font-mono tabular-nums">{formatMoney(uninvoicedData.totalInvoiced ?? 0)} ({uninvoicedData.invoicedPercent ?? 0}%)</span>
                        </div>
                        <div className="flex items-center justify-between text-[13px]">
                          <span className="text-muted-foreground">{t("remaining")}</span>
                          <span className="font-mono tabular-nums font-medium text-emerald-600">{formatMoney(uninvoicedData.remaining ?? 0)}</span>
                        </div>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-blue-500 transition-all"
                          style={{ width: `${uninvoicedData.invoicedPercent}%` }}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>{t("percentageToInvoice")}</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min={0}
                          max={100 - (uninvoicedData.invoicedPercent || 0)}
                          value={fixedPercent}
                          onChange={e => setFixedPercent(e.target.value)}
                          placeholder={t("percentageRange", { maximum: 100 - (uninvoicedData.invoicedPercent || 0) })}
                          className="font-mono"
                        />
                        <span className="text-[13px] text-muted-foreground shrink-0">%</span>
                      </div>
                      {fixedPercent && (
                        <p className="text-[11px] text-muted-foreground">
                          {t("invoiceAmount", { amount: formatMoney(invoicePreviewTotal) })}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Notes */}
                <div className="h-px bg-border" />
                <div className="space-y-2">
                  <Label>{t("invoiceNotes")}</Label>
                  <Textarea
                    value={invoiceNotes}
                    onChange={e => setInvoiceNotes(e.target.value)}
                    placeholder={t("invoiceNotesPlaceholder")}
                    rows={2}
                  />
                </div>
              </>
            ) : (
              <p className="text-[12px] text-muted-foreground py-3">{t("billingDataFailed")}</p>
            )}
          </div>

          {/* Footer with total preview */}
          <div className="sticky bottom-0 z-10 border-t bg-background/80 backdrop-blur-sm">
            {invoicePreviewTotal > 0 && (
              <div className="px-6 py-3 border-b bg-muted/30">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-medium text-muted-foreground">{t("invoiceTotal")}</span>
                  <span className="text-lg font-bold font-mono tabular-nums">{formatMoney(invoicePreviewTotal)}</span>
                </div>
              </div>
            )}
            <div className="flex items-center justify-end gap-3 px-6 py-4">
              <Button type="button" variant="outline" onClick={() => setInvoiceOpen(false)}>{t("cancel")}</Button>
              <Button
                onClick={handleCreateInvoice}
                disabled={invoiceSaving || invoicePreviewTotal <= 0}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {invoiceSaving ? t("creating") : t("createInvoice")}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
