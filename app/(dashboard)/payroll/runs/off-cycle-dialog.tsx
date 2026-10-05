"use client";

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
interface Employee { id: string; name: string; currency: string | null }
interface Parent { id: string; payPeriodStart: string; payPeriodEnd: string; items: { employeeId: string; currency: string | null; employee: { name: string } }[] }
const labels = { termination: "Final pay", "bonus-only": "Bonus only", correction: "Correct a completed payroll" };

export function OffCycleDialog({ type, onClose, start, end }: { type: OffCycleType | null; onClose: () => void; start: string; end: string }) {
  const router = useRouter();
  const [employees, setEmployees] = useState<Employee[]>([]), [parents, setParents] = useState<Parent[]>([]);
  const [employeeId, setEmployeeId] = useState(""), [parentRunId, setParentRunId] = useState("");
  const [periodStart, setPeriodStart] = useState(start), [periodEnd, setPeriodEnd] = useState(end);
  const [amount, setAmount] = useState(""), [notes, setNotes] = useState(""), [pto, setPto] = useState(false);
  const [busy, setBusy] = useState(false), [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!type) return;
    const abort = new AbortController(), orgId = localStorage.getItem("activeOrgId");
    if (!orgId) return;
    setLoading(true); setEmployeeId(""); setParentRunId(""); setAmount(""); setNotes(""); setPto(false); setPeriodStart(start); setPeriodEnd(end);
    async function load() {
      try {
        const loadPages = async (path: string) => {
          const rows: unknown[] = [];
          for (let page = 1; ; page++) {
            const res = await fetch(`${path}&limit=100&page=${page}`, { headers: { "x-organization-id": orgId! }, signal: abort.signal });
            const data = await res.json(); if (!res.ok) throw new Error(data.error || "Could not load payroll choices");
            rows.push(...data.data);
            if (page >= data.pagination.totalPages) return rows;
          }
        };
        if (type === "correction") setParents(await loadPages("/api/v1/payroll/runs?status=completed") as Parent[]);
        else setEmployees(await loadPages("/api/v1/payroll/employees?active=true") as Employee[]);
      } catch (error) { if (!abort.signal.aborted) toast.error(error instanceof Error ? error.message : "Could not load choices"); }
      finally { if (!abort.signal.aborted) setLoading(false); }
    }
    void load(); return () => abort.abort();
  }, [type, start, end]);
  const choices = type === "correction" ? [...new Map((parents.find(p => p.id === parentRunId)?.items ?? []).map(i => [i.employeeId, { id: i.employeeId, name: i.employee.name, currency: i.currency }])).values()] : employees;
  const currency = choices.find(e => e.id === employeeId)?.currency ?? "employee currency";
  async function submit() {
    if (!type) return;
    const orgId = localStorage.getItem("activeOrgId"); if (!orgId) return;
    setBusy(true);
    try {
      const negative = amount.startsWith("-"), cents = type === "termination" ? "0" : payrollCentsInput(negative ? amount.slice(1) : amount);
      const body = type === "correction" ? { parentRunId, notes, adjustments: [{ employeeId, grossAdjustmentMinor: negative ? "-" + cents : cents }] }
        : type === "termination" ? { employeeId, payPeriodStart: periodStart, payPeriodEnd: periodEnd, includeUnusedPto: pto, notes }
        : { payPeriodStart: periodStart, payPeriodEnd: periodEnd, notes, bonuses: [{ employeeId, bonusType: "other", amountMinor: cents }] };
      const res = await fetch(`/api/v1/payroll/runs/${type}`, { method: "POST", headers: { "Content-Type": "application/json", "x-organization-id": orgId }, body: JSON.stringify(body) });
      const data = await res.json(); if (!res.ok) throw new Error(data.error || "Could not create pay run");
      toast.success(data.run.status === "completed" ? "Pay run recorded" : "Pay run created; submit it for approval");
      onClose(); router.push(`/payroll/runs/${data.run.id}`);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not create pay run"); }
    finally { setBusy(false); }
  }
  return <Dialog open={type !== null} onOpenChange={open => { if (!open && !busy) onClose(); }}>
    <DialogContent><DialogHeader><DialogTitle>{type ? labels[type] : "One-off payment"}</DialogTitle>
      <DialogDescription>Recorded immediately unless your organization requires approval.</DialogDescription></DialogHeader>
      <form onSubmit={e => { e.preventDefault(); void submit(); }} className="space-y-4">
        {type === "correction" ? <div className="space-y-2"><Label htmlFor="payroll-parent">Completed payroll</Label>
          <Select value={parentRunId} onValueChange={v => { setParentRunId(v); setEmployeeId(""); }}><SelectTrigger id="payroll-parent"><SelectValue placeholder="Select completed run" /></SelectTrigger>
            <SelectContent>{parents.map(p => <SelectItem key={p.id} value={p.id}>{p.payPeriodStart} to {p.payPeriodEnd} · {p.id.slice(0, 8)}</SelectItem>)}</SelectContent></Select></div>
          : <div className="grid grid-cols-2 gap-3"><div className="space-y-2"><Label htmlFor="payroll-start">Period start</Label><Input id="payroll-start" type="date" required value={periodStart} onChange={e => setPeriodStart(e.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="payroll-end">Period end</Label><Input id="payroll-end" type="date" required min={periodStart} value={periodEnd} onChange={e => setPeriodEnd(e.target.value)} /></div></div>}
        <div className="space-y-2"><Label htmlFor="payroll-employee">Employee</Label><Select value={employeeId} onValueChange={setEmployeeId}>
          <SelectTrigger id="payroll-employee"><SelectValue placeholder={loading ? "Loading employees…" : "Select employee"} /></SelectTrigger>
          <SelectContent>{choices.map(e => <SelectItem key={e.id} value={e.id}>{e.name} · {e.currency ?? "employee currency"}</SelectItem>)}</SelectContent></Select></div>
        {type === "termination" ? <Label className="flex items-center gap-2"><input type="checkbox" checked={pto} onChange={e => setPto(e.target.checked)} />Pay unused PTO</Label>
          : <div className="space-y-2"><Label htmlFor="payroll-adjustment">{type === "correction" ? "Gross adjustment" : "Bonus amount"} ({currency})</Label>
            <Input id="payroll-adjustment" inputMode="decimal" required value={amount} onChange={e => setAmount(e.target.value)} placeholder={type === "correction" ? "e.g. -12.50 or 12.50" : "e.g. 12.50"} />
            {type === "correction" && <p className="text-xs text-muted-foreground">Positive adds pay; negative recovers pay. The parent payroll stays unchanged.</p>}</div>}
        <div className="space-y-2"><Label htmlFor="payroll-notes">Notes</Label><Input id="payroll-notes" value={notes} onChange={e => setNotes(e.target.value)} /></div>
        <DialogFooter><Button type="submit" disabled={busy || loading || !employeeId || (type === "correction" && !parentRunId)}>{busy ? "Creating…" : "Create pay run"}</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}
