"use client";
import { usePresentation } from "@/i18n/provider";
import { currencyLabel } from "@/i18n/currency-labels";

import { payrollRunJson, type PayrollRunEmployee as Employee, type PayrollRunParent as Parent } from "@/i18n/payroll-run-presentation";
import { useTranslations } from "next-intl";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { payrollCentsInput } from "@/lib/money/payroll-input";

export type OffCycleType = "termination" | "bonus-only" | "correction";
export function OffCycleDialog({ type, onClose, start, end }: { type: OffCycleType | null; onClose: () => void; start: string; end: string }) {
  const unitPresentation = usePresentation();
  const t = useTranslations("PayrollRuns");
  const labels = { termination: t("finalPay"), "bonus-only": t("bonusOnly"), correction: t("correctCompleted") };
  const router = useRouter();
  const [employees, setEmployees] = useState<Employee[]>([]), [parents, setParents] = useState<Parent[]>([]);
  const [employeeId, setEmployeeId] = useState(""), [parentRunId, setParentRunId] = useState("");
  const [periodStart, setPeriodStart] = useState(start), [periodEnd, setPeriodEnd] = useState(end);
  const [amount, setAmount] = useState(""), [notes, setNotes] = useState(""), [pto, setPto] = useState(false);
  const [busy, setBusy] = useState(false), [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!type) return;
    const abort = new AbortController();
    setLoading(true); setEmployees([]); setParents([]); setEmployeeId(""); setParentRunId(""); setAmount(""); setNotes(""); setPto(false); setPeriodStart(start); setPeriodEnd(end);
    async function load() {
      try {
        const orgId = localStorage.getItem("activeOrgId");
        if (!orgId) { toast.error(t("organizationRequired")); return; }
        const loadPages = async <K extends "parents" | "employees",>(path: string, kind: K) => {
          const rows: (K extends "parents" ? Parent : Employee)[] = [];
          for (let page = 1; ; page++) {
            const res = await fetch(`${path}&limit=100&page=${page}`, { headers: { "x-organization-id": orgId }, signal: abort.signal });
            const data = await payrollRunJson(res, kind);
            if (abort.signal.aborted) return [];
            if (data.pagination.page !== page || data.pagination.limit !== 100) throw new Error("Invalid choices page");
            rows.push(...data.data as typeof rows);
            if (page >= data.pagination.totalPages) return rows;
          }
        };
        if (type === "correction") {
          const rows = await loadPages("/api/v1/payroll/runs?status=completed", "parents");
          if (!abort.signal.aborted) setParents(rows);
        } else {
          const rows = await loadPages("/api/v1/payroll/employees?active=true", "employees");
          if (!abort.signal.aborted) setEmployees(rows);
        }
      } catch { if (!abort.signal.aborted) toast.error(t("choicesFailed")); }
      finally { if (!abort.signal.aborted) setLoading(false); }
    }
    void load(); return () => abort.abort();
  }, [type, start, end, t]);
  const choices = type === "correction" ? [...new Map((parents.find(p => p.id === parentRunId)?.items ?? []).map(i => [i.employeeId, { id: i.employeeId, name: i.employee.name, currency: i.currency }])).values()] : employees;
  const currency = choices.find(e => e.id === employeeId)?.currency ?? t("employeeCurrency");
  async function submit() {
    if (!type) return;
    setBusy(true);
    try {
      const orgId = localStorage.getItem("activeOrgId");
      if (!orgId) { toast.error(t("organizationRequired")); return; }
      const negative = amount.startsWith("-"), cents = type === "termination" ? "0" : payrollCentsInput(negative ? amount.slice(1) : amount);
      const body = type === "correction" ? { parentRunId, notes, adjustments: [{ employeeId, grossAdjustmentMinor: negative ? "-" + cents : cents }] }
        : type === "termination" ? { employeeId, payPeriodStart: periodStart, payPeriodEnd: periodEnd, includeUnusedPto: pto, notes }
        : { payPeriodStart: periodStart, payPeriodEnd: periodEnd, notes, bonuses: [{ employeeId, bonusType: "other", amountMinor: cents }] };
      const res = await fetch(`/api/v1/payroll/runs/${type}`, { method: "POST", headers: { "Content-Type": "application/json", "x-organization-id": orgId }, body: JSON.stringify(body) });
      const data = await payrollRunJson(res, "created");
      toast.success(t(data.run.status === "completed" ? "recorded" : "approvalCreated"));
      onClose(); router.push(`/payroll/runs/${data.run.id}`);
    } catch { toast.error(t("createFailed")); }
    finally { setBusy(false); }
  }
  return <Dialog open={type !== null} onOpenChange={open => { if (!open && !busy) onClose(); }}>
    <DialogContent><DialogHeader><DialogTitle>{type ? labels[type] : t("oneOff")}</DialogTitle>
      <DialogDescription>{t("approvalHelp")}</DialogDescription></DialogHeader>
      <form onSubmit={e => { e.preventDefault(); void submit(); }} className="space-y-4">
        {type === "correction" ? <div className="space-y-2"><Label htmlFor="payroll-parent">{t("completedPayroll")}</Label>
          <Select value={parentRunId} onValueChange={v => { setParentRunId(v); setEmployeeId(""); }}><SelectTrigger id="payroll-parent"><SelectValue placeholder={t("selectCompleted")} /></SelectTrigger>
            <SelectContent>{parents.map(p => <SelectItem key={p.id} value={p.id}>{t("parentOption", { start: p.payPeriodStart, end: p.payPeriodEnd, id: p.id.slice(0, 8) })}</SelectItem>)}</SelectContent></Select></div>
          : <div className="grid grid-cols-2 gap-3"><div className="space-y-2"><Label htmlFor="payroll-start">{t("periodStart")}</Label><Input id="payroll-start" type="date" required value={periodStart} onChange={e => setPeriodStart(e.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="payroll-end">{t("periodEnd")}</Label><Input id="payroll-end" type="date" required min={periodStart} value={periodEnd} onChange={e => setPeriodEnd(e.target.value)} /></div></div>}
        <div className="space-y-2"><Label htmlFor="payroll-employee">{t("employee")}</Label><Select value={employeeId} onValueChange={setEmployeeId}>
          <SelectTrigger id="payroll-employee"><SelectValue placeholder={loading ? t("loadingEmployees") : t("selectEmployee")} /></SelectTrigger>
          <SelectContent>{choices.map(e => <SelectItem key={e.id} value={e.id}>{t("employeeOption", { name: e.name, currency: currencyLabel(e.currency ?? t("employeeCurrency"), unitPresentation.locale) })}</SelectItem>)}</SelectContent></Select></div>
        {type === "termination" ? <Label className="flex items-center gap-2"><input type="checkbox" checked={pto} onChange={e => setPto(e.target.checked)} />{t("pto")}</Label>
          : <div className="space-y-2"><Label htmlFor="payroll-adjustment">{t(type === "correction" ? "adjustment" : "bonusAmount", { currency: currencyLabel(currency, unitPresentation.locale) })}</Label>
            <Input id="payroll-adjustment" inputMode="decimal" required value={amount} onChange={e => setAmount(e.target.value)} placeholder={type === "correction" ? t("signedExample") : t("amountExample")} />
            {type === "correction" && <p className="text-xs text-muted-foreground">{t("adjustmentHelp")}</p>}</div>}
        <div className="space-y-2"><Label htmlFor="payroll-notes">{t("notes")}</Label><Input id="payroll-notes" value={notes} onChange={e => setNotes(e.target.value)} /></div>
        <DialogFooter><Button type="submit" disabled={busy || loading || !employeeId || (type === "correction" && !parentRunId)}>{busy ? t("creating") : t("createPayRun")}</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}
