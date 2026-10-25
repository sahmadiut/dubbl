"use client";

import { BidiText, IdentifierText } from "@/components/ui/bidi-text";
import { currencyLabel } from "@/i18n/currency-labels";
import { usePresentation as useUnitPresentation } from "@/i18n/provider";

import { payrollSum } from "@/lib/money/payroll-ui";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { payrollRunDetailJson, type PayrollRunDetail, type PayrollBonus as Bonus } from "@/i18n/payroll-run-detail-presentation";
import { useParams, useRouter } from "next/navigation";
import { motion } from "motion/react";
import { toast } from "sonner";
import { ArrowLeft, Play, Search, X, FileText, CheckCircle2, XCircle, Gift, ScrollText, Send, Plus, BookOpen, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { ContentReveal } from "@/components/ui/content-reveal";
import { BrandLoader } from "@/components/dashboard/brand-loader";
import { payrollCentsInput } from "@/lib/money/payroll-input";
import { payrollMoneyDisplay as formatMoney } from "@/lib/money/payroll-display";
import { useConfirm } from "@/lib/hooks/use-confirm";
import { useDebounce } from "@/lib/hooks/use-debounce";
import { useDocumentTitle } from "@/lib/hooks/use-document-title";
import { cn } from "@/lib/utils";

const statusColors: Record<string, string> = {
  draft: "",
  processing: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300",
  completed: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  void: "border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-300",
  pending_approval: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300",
};

const bonusTypes = ["performance", "signing", "holiday", "referral", "retention", "other"] as const;

const anim = (delay: number) => ({
  initial: { opacity: 0, y: 12 } as const,
  animate: { opacity: 1, y: 0 } as const,
  transition: { duration: 0.3, delay } as const,
});

export default function PayrollRunDetailPage() {
  const unitPresentation = useUnitPresentation();
  const t = useTranslations("PayrollRunDetail");
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [run, setRun] = useState<PayrollRunDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [moneyError, setMoneyError] = useState<"readFailed" | "organizationRequired" | null>(null);
  const [processing, setProcessing] = useState(false);
  const [submittingApproval, setSubmittingApproval] = useState(false);
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [generatingPayslips, setGeneratingPayslips] = useState(false);
  const { confirm, dialog: confirmDialog } = useConfirm();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search);
  useDocumentTitle(t("documentTitle"));

  const [bonuses, setBonuses] = useState<Bonus[]>([]);
  const [bonusDialogOpen, setBonusDialogOpen] = useState(false);
  const [bonusForm, setBonusForm] = useState({
    employeeId: "",
    bonusType: "",
    amount: "",
    description: "",
  });
  const [creatingBonus, setCreatingBonus] = useState(false);

  function activeOrganization() {
    try {
      const orgId = localStorage.getItem("activeOrgId");
      if (orgId) return orgId;
    } catch { /* Storage errors use the same finite organization feedback. */ }
    toast.error(t("organizationRequired"));
    return null;
  }

  useEffect(() => {
    let active = true;
    setLoading(true); setMoneyError(null); setRun(null); setBonuses([]);
    async function load() {
      let orgId: string | null;
      try { orgId = localStorage.getItem("activeOrgId"); }
      catch { if (active) { setMoneyError("organizationRequired"); setLoading(false); } return; }
      if (!orgId) { if (active) { setMoneyError("organizationRequired"); setLoading(false); } return; }
      try {
        const response = await fetch(`/api/v1/payroll/runs/${id}`, { headers: { "x-organization-id": orgId } });
        if (!active) return;
        if (response.status === 404) return;
        const data = await payrollRunDetailJson(response, "detail");
        if (!active) return;
        const listed = await payrollRunDetailJson(await fetch(`/api/v1/payroll/runs/${id}/bonuses`, {
          headers: { "x-organization-id": orgId },
        }), "bonuses");
        if (active) { setRun(data.run); setBonuses(listed.bonuses); }
      } catch { if (active) setMoneyError("readFailed"); }
      finally { if (active) setLoading(false); }
    }
    void load();
    return () => { active = false; };
  }, [id, t]);

  async function handleProcess() {
    const confirmed = await confirm({
      title: t("finishTitle"),
      description:
        t("finishDescription"),
      confirmLabel: t("finishConfirm"),
      destructive: true,
    });
    if (!confirmed) return;
    const orgId = activeOrganization();
    if (!orgId) return;
    setProcessing(true);

    try {
      const res = await fetch(`/api/v1/payroll/runs/${id}/process`, {
        method: "POST",
        headers: { "x-organization-id": orgId },
      });
      await payrollRunDetailJson(res, "detail");
      toast.success(t("finished"));
      window.location.reload();
    } catch {
      toast.error(t("processFailed"));
    } finally {
      setProcessing(false);
    }
  }

  async function handleSubmitForApproval() {
    const orgId = activeOrganization();
    if (!orgId) return;
    setSubmittingApproval(true);

    try {
      const res = await fetch(`/api/v1/payroll/runs/${id}/submit-for-approval`, {
        method: "POST",
        headers: { "x-organization-id": orgId },
      });
      await payrollRunDetailJson(res, "detail");
      toast.success(t("submitted"));
      window.location.reload();
    } catch {
      toast.error(t("submitFailed"));
    } finally {
      setSubmittingApproval(false);
    }
  }

  async function handleApprove() {
    const confirmed = await confirm({
      title: t("approveTitle"),
      description: t("approveDescription"),
      confirmLabel: t("approve"),
    });
    if (!confirmed) return;
    const orgId = activeOrganization();
    if (!orgId) return;
    setApproving(true);

    try {
      const res = await fetch(`/api/v1/payroll/runs/${id}/approve`, {
        method: "POST",
        headers: { "x-organization-id": orgId },
      });
      await payrollRunDetailJson(res, "detail");
      toast.success(t("approved"));
      window.location.reload();
    } catch {
      toast.error(t("approveFailed"));
    } finally {
      setApproving(false);
    }
  }

  async function handleReject() {
    const confirmed = await confirm({
      title: t("rejectTitle"),
      description: t("rejectDescription"),
      confirmLabel: t("reject"),
      destructive: true,
    });
    if (!confirmed) return;
    const orgId = activeOrganization();
    if (!orgId) return;
    setRejecting(true);

    try {
      const res = await fetch(`/api/v1/payroll/runs/${id}/reject`, {
        method: "POST",
        headers: { "x-organization-id": orgId },
      });
      await payrollRunDetailJson(res, "detail");
      toast.success(t("rejected"));
      window.location.reload();
    } catch {
      toast.error(t("rejectFailed"));
    } finally {
      setRejecting(false);
    }
  }

  async function handleGeneratePayslips() {
    const orgId = activeOrganization();
    if (!orgId) return;
    setGeneratingPayslips(true);

    try {
      const res = await fetch(`/api/v1/payroll/runs/${id}/generate-payslips`, {
        method: "POST",
        headers: { "x-organization-id": orgId },
      });
      await payrollRunDetailJson(res, "payslips");
      toast.success(t("payslipsGenerated"));
      router.push(`/payroll/runs/${id}/payslips`);
    } catch {
      toast.error(t("payslipsFailed"));
    } finally {
      setGeneratingPayslips(false);
    }
  }

  async function handleCreateBonus() {
    const orgId = activeOrganization();
    if (!orgId) return;
    if (!bonusForm.employeeId || !bonusForm.bonusType || !bonusForm.amount) {
      toast.error(t("required"));
      return;
    }
    setCreatingBonus(true);

    try {
      const res = await fetch(`/api/v1/payroll/runs/${id}/bonuses`, {
        method: "POST",
        headers: {
          "x-organization-id": orgId,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          employeeId: bonusForm.employeeId,
          bonusType: bonusForm.bonusType,
          amountMinor: payrollCentsInput(bonusForm.amount),
          description: bonusForm.description || null,
        }),
      });
      const data = await payrollRunDetailJson(res, "bonus");
      if (data.bonus) {
        const [runResponse, bonusResponse] = await Promise.all([
          fetch(`/api/v1/payroll/runs/${id}`, { headers: { "x-organization-id": orgId } }),
          fetch(`/api/v1/payroll/runs/${id}/bonuses`, { headers: { "x-organization-id": orgId } }),
        ]);
        const [updated, listed] = await Promise.all([payrollRunDetailJson(runResponse, "detail"), payrollRunDetailJson(bonusResponse, "bonuses")]);
        setRun(updated.run); setBonuses(listed.bonuses);
      }
      toast.success(t("bonusAdded"));
      setBonusDialogOpen(false);
      setBonusForm({ employeeId: "", bonusType: "", amount: "", description: "" });
    } catch {
      toast.error(t("bonusFailed"));
    } finally {
      setCreatingBonus(false);
    }
  }

  if (loading) return <BrandLoader />;
  if (moneyError) return <p role="alert">{t(moneyError)}</p>;

  if (!run) {
    return (
      <ContentReveal>
        <button
          onClick={() => router.push("/payroll/runs")}
          className="flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="size-3.5 rtl:rotate-180" />
          {t("back")}
        </button>
        <p className="text-sm text-muted-foreground">{t("notFound")}</p>
      </ContentReveal>
    );
  }

  const filteredItems = (run.items || []).filter((item) => {
    if (!debouncedSearch) return true;
    const q = debouncedSearch.toLowerCase();
    const nameMatch = item.employee?.name.toLowerCase().includes(q);
    const numMatch = item.employee?.employeeNumber.toLowerCase().includes(q);
    return nameMatch || numMatch;
  });

  return (
    <ContentReveal className="space-y-6">
      {/* Back link */}
      <button
        onClick={() => router.push("/payroll/runs")}
        className="flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="size-3.5 rtl:rotate-180" />
        {t("back")}
      </button>

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 flex-wrap">
          <div className={cn(
            "flex size-10 items-center justify-center rounded-xl",
            run.status === "completed"
              ? "bg-emerald-50 dark:bg-emerald-950/40"
              : "bg-muted"
          )}>
            <FileText className={cn(
              "size-5",
              run.status === "completed"
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-muted-foreground"
            )} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-semibold">
                {t.rich("period", { code: (chunks) => <IdentifierText>{chunks}</IdentifierText>,  start: run.payPeriodStart, end: run.payPeriodEnd  })}
              </h1>
              <Badge variant="outline" className={statusColors[run.status] || ""}>
                {t(`status_${run.status}`)}
              </Badge>
              {run.runType && run.runType !== "regular" && (
                <Badge variant="outline" className="capitalize">
                  {t(`runType_${run.runType}`)}
                </Badge>
              )}
              {run.approvalStatus && (
                <Badge
                  variant="outline"
                  className="border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300"
                >
                  {t(`approval_${run.approvalStatus}`)}
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {run.processedAt ? t.rich("processedAt", { code: (chunks) => <IdentifierText>{chunks}</IdentifierText>,  date: run.processedAt  }) : t("unfinished")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {run.status === "draft" && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSubmitForApproval}
                disabled={submittingApproval}
                title={t("sendHelp")} className="h-auto min-h-8 max-w-full whitespace-normal py-1.5 [overflow-wrap:anywhere]" >
                <Send className="me-1.5 size-3.5" />
                {submittingApproval ? t("sending") : t("send")}
              </Button>
              <Button
                size="sm"
                onClick={handleProcess}
                disabled={processing}
                className="bg-emerald-600 hover:bg-emerald-700 h-auto min-h-8 max-w-full whitespace-normal py-1.5 [overflow-wrap:anywhere]"
                title={t("finishHelp")}
              >
                <Play className="me-1.5 size-3.5" />
                {processing ? t("finishing") : t("finish")}
              </Button>
            </>
          )}
          {run.status === "pending_approval" && (
            <>
              <Button
                size="sm"
                onClick={handleApprove}
                disabled={approving}
                className="bg-emerald-600 hover:bg-emerald-700 h-auto min-h-8 max-w-full whitespace-normal py-1.5 [overflow-wrap:anywhere]"
              >
                <CheckCircle2 className="me-1.5 size-3.5" />
                {approving ? t("approving") : t("approve")}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleReject}
                disabled={rejecting} className="h-auto min-h-8 max-w-full whitespace-normal py-1.5 [overflow-wrap:anywhere]" >
                <XCircle className="me-1.5 size-3.5" />
                {rejecting ? t("rejecting") : t("reject")}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 [&>*]:min-w-0">
        <motion.div {...anim(0)} className="rounded-xl border bg-card p-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{t("gross")}</p>
          <p className="mt-1 text-2xl font-bold font-mono tabular-nums [overflow-wrap:anywhere]"><IdentifierText>{formatMoney(run.totalGross, run.baseCurrency ?? "USD", unitPresentation)}</IdentifierText></p>
        </motion.div>
        <motion.div {...anim(0.05)} className="rounded-xl border bg-card p-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{t("deductions")}</p>
          <p className="mt-1 text-2xl font-bold font-mono tabular-nums [overflow-wrap:anywhere] text-red-600 dark:text-red-400"><IdentifierText>{formatMoney(run.totalDeductions, run.baseCurrency ?? "USD", unitPresentation)}</IdentifierText></p>
        </motion.div>
        <motion.div {...anim(0.09)} className="rounded-xl border bg-card p-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{t("net")}</p>
          <p className="mt-1 text-2xl font-bold font-mono tabular-nums [overflow-wrap:anywhere] text-emerald-600 dark:text-emerald-400"><IdentifierText>{formatMoney(run.totalNet, run.baseCurrency ?? "USD", unitPresentation)}</IdentifierText></p>
        </motion.div>
      </div>

      {/* Accounting entry (GL journal posted when the run was finished) */}
      {run.journalEntryId ? (
        <motion.button
          {...anim(0.12)}
          onClick={() => router.push(`/accounting/${run.journalEntryId}`)}
          className="group flex w-full items-center justify-between gap-4 rounded-xl border bg-card p-4 text-start transition-colors hover:bg-muted/50"
        >
          <div className="flex items-center gap-3 min-w-0 flex-wrap">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted">
              <BookOpen className="size-5 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium">{t("viewEntry")}</p>
              <p className="text-xs text-muted-foreground [overflow-wrap:anywhere]">
                {t.rich("entrySummary", { code: (chunks) => <IdentifierText>{chunks}</IdentifierText>,  gross: formatMoney(run.totalGross, run.baseCurrency ?? "USD", unitPresentation), deductions: formatMoney(run.totalDeductions, run.baseCurrency ?? "USD", unitPresentation), net: formatMoney(run.totalNet, run.baseCurrency ?? "USD", unitPresentation)  })}
              </p>
            </div>
          </div>
          <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 rtl:rotate-180" />
        </motion.button>
      ) : run.status === "completed" ? (
        <div className="flex items-center gap-3 rounded-xl border border-dashed bg-card p-4 flex-wrap">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted">
            <BookOpen className="size-5 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-medium">{t("noEntry")}</p>
            <p className="text-xs text-muted-foreground">{t("noEntryHelp")}</p>
          </div>
        </div>
      ) : null}

      {/* Employee items */}
      <div className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-sm font-semibold">{t("employees", { count: run.items.length })}</h3>
          <div className="relative sm:max-w-xs w-full">
            <Search className="pointer-events-none absolute start-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={t("search")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="ps-9 pe-8 h-8 text-sm" dir="auto" aria-label={t("search")} />
            {search && (
              <button
                onClick={() => setSearch("")}
                aria-label={t("clearSearch")}
                className="absolute end-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
        </div>

        {filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="mx-auto flex size-10 items-center justify-center rounded-xl bg-muted mb-3">
              <FileText className="size-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">
              {search ? t("noMatch") : t("noEmployees")}
            </p>
          </div>
        ) : (
          <div className="rounded-xl border bg-card divide-y">
            {filteredItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-4 px-4 py-3 flex-wrap"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium [overflow-wrap:anywhere]"><BidiText>{item.employee?.name || "-"}</BidiText></p>
                  <p className="text-xs text-muted-foreground font-mono"><IdentifierText>{item.employee?.employeeNumber}</IdentifierText></p>
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    {item.type && (
                      <Badge variant="outline" className="text-[9px] h-4 capitalize">
                        {t(`itemType_${item.type}`)}
                      </Badge>
                    )}
                    {item.description && (
                      <span className="text-[10px] text-muted-foreground [overflow-wrap:anywhere] max-w-[200px]"><BidiText>{item.description}</BidiText></span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-4 shrink-0 flex-wrap">
                  {item.currency && item.currency !== "USD" && (
                    <Badge variant="outline" className="text-[9px] h-4 font-mono shrink-0">
                      <IdentifierText>{currencyLabel(item.currency, unitPresentation.locale)}</IdentifierText>
                      {item.fxRate && item.fxRate !== 1 && (
                        <span className="ms-0.5 text-muted-foreground">@ <IdentifierText>{item.rateExact}</IdentifierText></span>
                      )}
                    </Badge>
                  )}
                  <div className="hidden sm:block text-end">
                    <p className="text-xs text-muted-foreground">{t("beforeDeductions")}</p>
                    <p className="text-sm font-mono tabular-nums"><IdentifierText>{formatMoney(item.grossAmount, item.currency ?? "USD", unitPresentation)}</IdentifierText></p>
                  </div>
                  <div className="hidden sm:block text-end">
                    <p className="text-xs text-muted-foreground">{t("tax")}</p>
                    <p className="text-sm font-mono tabular-nums"><IdentifierText>{formatMoney(item.taxAmount, item.currency ?? "USD", unitPresentation)}</IdentifierText></p>
                  </div>
                  <div className="hidden sm:block text-end">
                    <p className="text-xs text-muted-foreground">{t("otherDeductions")}</p>
                    <p className="text-sm font-mono tabular-nums"><IdentifierText>{formatMoney(payrollSum([item.preTaxDeductions ?? 0, item.postTaxDeductions ?? 0]), item.currency ?? "USD", unitPresentation)}</IdentifierText></p>
                  </div>
                  <div className="text-end">
                    <p className="text-xs text-muted-foreground">{t("takeHome")}</p>
                    <p className="text-sm font-mono tabular-nums font-medium"><IdentifierText>{formatMoney(item.netAmount, item.currency ?? "USD", unitPresentation)}</IdentifierText></p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bonuses section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between flex-wrap">
          <h3 className="text-sm font-semibold flex items-center gap-1.5">
            <Gift className="size-4" />
            {t("bonuses", { count: bonuses.length })}
          </h3>
          <Dialog open={bonusDialogOpen} onOpenChange={setBonusDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" disabled={run.status !== "draft" || run.approvalStatus === "approved" || !["regular", "off_cycle", "bonus_only"].includes(run.runType)} className="h-auto min-h-8 max-w-full whitespace-normal py-1.5 [overflow-wrap:anywhere]" >
                <Plus className="me-1.5 size-3.5" />
                {t("addBonus")}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("addBonus")}</DialogTitle>
                <DialogDescription>
                  {t("addBonusHelp")}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label htmlFor="payroll-runs-id-1" >{t("employee")}</Label>
                  <Select
                    value={bonusForm.employeeId}
                    onValueChange={(v) => setBonusForm((f) => ({ ...f, employeeId: v }))}
                  >
                    <SelectTrigger className="h-auto min-h-8 max-w-full whitespace-normal py-1.5 [overflow-wrap:anywhere] data-[size=default]:h-auto data-[size=sm]:h-auto *:data-[slot=select-value]:line-clamp-none *:data-[slot=select-value]:whitespace-normal" id="payroll-runs-id-1" aria-label={t("employee")} >
                      <SelectValue placeholder={t("selectEmployee")} />
                    </SelectTrigger>
                    <SelectContent>
                      {(run.items || []).filter((item, index, items) => items.findIndex(i => i.employeeId === item.employeeId) === index).map((item) =>
                        item.employee ? (
                          <SelectItem key={item.employeeId} value={item.employeeId}>
                            {t.rich("employeeOption", { em: (chunks) => <BidiText>{chunks}</BidiText>, code: (chunks) => <IdentifierText>{chunks}</IdentifierText>,  name: item.employee.name, number: item.employee.employeeNumber  })}
                          </SelectItem>
                        ) : null
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="payroll-runs-id-2" >{t("bonusTypeLabel")}</Label>
                  <Select
                    value={bonusForm.bonusType}
                    onValueChange={(v) => setBonusForm((f) => ({ ...f, bonusType: v }))}
                  >
                    <SelectTrigger className="h-auto min-h-8 max-w-full whitespace-normal py-1.5 [overflow-wrap:anywhere] data-[size=default]:h-auto data-[size=sm]:h-auto *:data-[slot=select-value]:line-clamp-none *:data-[slot=select-value]:whitespace-normal" id="payroll-runs-id-2" aria-label={t("bonusTypeLabel")} >
                      <SelectValue placeholder={t("selectType")} />
                    </SelectTrigger>
                    <SelectContent>
                      {bonusTypes.map((type) => (
                        <SelectItem key={type} value={type}>
                          {t(`bonusType_${type}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="payroll-runs-id-3" >{t("amount")}</Label>
                  <CurrencyInput
                    prefix={run.items.find(i => i.employeeId === bonusForm.employeeId)?.currency ?? "USD"}
                    value={bonusForm.amount}
                    onChange={(v) => setBonusForm((f) => ({ ...f, amount: v }))} id="payroll-runs-id-3" aria-label={t("amount")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="payroll-runs-id-4" >{t("description")}</Label>
                  <Textarea
                    placeholder={t("descriptionPlaceholder")}
                    value={bonusForm.description}
                    onChange={(e) => setBonusForm((f) => ({ ...f, description: e.target.value }))} dir="auto" id="payroll-runs-id-4" aria-label={t("description")} />
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={handleCreateBonus}
                  disabled={creatingBonus}
                  size="sm" className="h-auto min-h-8 max-w-full whitespace-normal py-1.5 [overflow-wrap:anywhere]" >
                  {creatingBonus ? t("adding") : t("addBonus")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {bonuses.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center rounded-xl border bg-card">
            <div className="mx-auto flex size-10 items-center justify-center rounded-xl bg-muted mb-3">
              <Gift className="size-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">{t("noBonuses")}</p>
            <p className="text-xs text-muted-foreground mt-1">{t("noBonusesHelp")}</p>
          </div>
        ) : (
          <div className="rounded-xl border bg-card divide-y">
            {bonuses.map((bonus) => (
              <div
                key={bonus.id}
                className="flex items-center justify-between gap-4 px-4 py-3 flex-wrap"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium [overflow-wrap:anywhere]"><BidiText>{bonus.employee?.name || "-"}</BidiText></p>
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    <Badge variant="outline" className="text-[9px] h-4 capitalize">
                      {t(`bonusType_${bonus.bonusType}`)}
                    </Badge>
                    {bonus.description && (
                      <span className="text-[10px] text-muted-foreground [overflow-wrap:anywhere] max-w-[200px]"><BidiText>{bonus.description}</BidiText></span>
                    )}
                  </div>
                </div>
                <p className="text-sm font-mono tabular-nums font-medium shrink-0">
                  <IdentifierText>{formatMoney(bonus.amount, bonus.employee?.currency ?? "USD", unitPresentation)}</IdentifierText>
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Generate Payslips */}
      {run.status === "completed" && (
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            onClick={handleGeneratePayslips}
            disabled={generatingPayslips} className="h-auto min-h-8 max-w-full whitespace-normal py-1.5 [overflow-wrap:anywhere]" >
            <ScrollText className="me-1.5 size-3.5" />
            {generatingPayslips ? t("generating") : t("generate")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(`/payroll/runs/${id}/payslips`)} className="h-auto min-h-8 max-w-full whitespace-normal py-1.5 [overflow-wrap:anywhere]" >
            <ScrollText className="me-1.5 size-3.5" />
            {t("viewPayslips")}
          </Button>
        </div>
      )}

      {confirmDialog}
    </ContentReveal>
  );
}
