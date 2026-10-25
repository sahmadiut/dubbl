"use client";

import { BidiText, IdentifierText } from "@/components/ui/bidi-text";

import { useTranslations } from "next-intl";
import { payrollTimeMatch, payrollTimeJson, payrollTimeOrganization, type LeaveRow } from "@/i18n/payroll-time-presentation";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { CalendarDays, Plus, Search } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ContentReveal } from "@/components/ui/content-reveal";
import { BrandLoader } from "@/components/dashboard/brand-loader";
import { useDebounce } from "@/lib/hooks/use-debounce";
import { useDocumentTitle } from "@/lib/hooks/use-document-title";
import { cn } from "@/lib/utils";

type LeaveRequest = LeaveRow;

type StatusFilter = "all" | "pending" | "approved" | "rejected";

const statusColors: Record<string, string> = {
  pending: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300",
  approved: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  rejected: "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300",
  cancelled: "border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-300",
};

export default function LeavePage() {
  const t = useTranslations("PayrollTimeDetail");
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [moneyError, setMoneyError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  const [employees, setEmployees] = useState<{ id: string; name: string }[]>([]);
  const [policies, setPolicies] = useState<{ id: string; name: string }[]>([]);
  const [form, setForm] = useState({ employeeId: "", policyId: "", startDate: "", endDate: "", hours: "", reason: "" });
  useDocumentTitle(t("leaveTitle"));

  const orgId = payrollTimeOrganization();

  const fetchData = useCallback(async (current: () => boolean = () => true, initial = false) => {
    if (!orgId) { if (current()) setLoading(false); return; }
    const headers = { "x-organization-id": orgId };
    try {
      const [rows, choices, policies] = await Promise.all([
        fetch("/api/v1/payroll/leave/requests", { headers }).then(r => payrollTimeJson(r, "leave")),
        fetch("/api/v1/payroll/employees", { headers }).then(r => payrollTimeJson(r, "employees")),
        fetch("/api/v1/payroll/leave/policies", { headers }).then(r => payrollTimeJson(r, "policies")),
      ]);
      if (!current()) return;
      setRequests(rows.data);
      setEmployees(choices.data.map(e => ({ id: e.id, name: e.name })));
      setPolicies(policies.data.map(p => ({ id: p.id, name: p.name })));
      setMoneyError(null);
    } catch {
      if (current()) { if (initial) setMoneyError("loadFailed"); else toast.error(t("loadFailed")); }
    } finally { if (current()) setLoading(false); }
  }, [orgId, t]);

  useEffect(() => { let active = true; void fetchData(() => active, true); return () => { active = false; }; }, [fetchData]);

  const filtered = requests.filter((r) => {
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      return r.employee?.name.toLowerCase().includes(q) || false;
    }
    return true;
  });

  async function handleCreate() {
    if (!orgId || creating || !form.employeeId || !form.policyId) return;
    setCreating(true);
    try {
      await payrollTimeJson(await fetch("/api/v1/payroll/leave/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-organization-id": orgId },
        body: JSON.stringify({ ...form, hours: parseFloat(form.hours || "0") }),
      }), "leaveCreated");
      toast.success(t("leaveCreated"));
      setDialogOpen(false);
      void fetchData();
    } catch { toast.error(t("createLeaveFailed")); }
    finally { setCreating(false); }
  }

  async function handleApprove(id: string) {
    if (!orgId) return;
    try {
      const data = await payrollTimeJson(await fetch(`/api/v1/payroll/leave/requests/${id}/approve`, {
        method: "POST", headers: { "x-organization-id": orgId },
      }), "approved");
      payrollTimeMatch(data.request, id);
      toast.success(t("leaveApproved")); void fetchData();
    } catch { toast.error(t("approveFailed")); }
  }

  async function handleReject(id: string) {
    if (!orgId) return;
    try {
      const data = await payrollTimeJson(await fetch(`/api/v1/payroll/leave/requests/${id}/reject`, {
        method: "POST", headers: { "Content-Type": "application/json", "x-organization-id": orgId }, body: JSON.stringify({}),
      }), "rejected");
      payrollTimeMatch(data.request, id);
      toast.success(t("leaveRejected")); void fetchData();
    } catch { toast.error(t("rejectFailed")); }
  }

  if (loading) return <BrandLoader />;
  if (moneyError) return <p role="alert">{t("loadFailed")}</p>;

  return (
    <ContentReveal className="space-y-6">
      <PageHeader title={t("leaveHeading")} description={t("leaveDescription")} />

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
            <TabsList className="flex-wrap h-auto min-h-9 max-w-full flex-wrap">
              <TabsTrigger value="all" className="h-auto min-h-8 whitespace-normal [overflow-wrap:anywhere]" >{t("all")}</TabsTrigger>
              <TabsTrigger value="pending" className="h-auto min-h-8 whitespace-normal [overflow-wrap:anywhere]" >{t("pending")}</TabsTrigger>
              <TabsTrigger value="approved" className="h-auto min-h-8 whitespace-normal [overflow-wrap:anywhere]" >{t("approved")}</TabsTrigger>
              <TabsTrigger value="rejected" className="h-auto min-h-8 whitespace-normal [overflow-wrap:anywhere]" >{t("rejected")}</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button size="sm" className=" text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 h-auto min-h-8 max-w-full whitespace-normal py-1.5 [overflow-wrap:anywhere]" onClick={() => setDialogOpen(true)}>
            <Plus className="size-3" /> {t("newRequest")}
          </Button>
        </div>

        <div className="relative sm:max-w-xs">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder={t("employeeSearch")} value={search} onChange={(e) => setSearch(e.target.value)} className="ps-9 h-8 text-sm" dir="auto" aria-label={t("employeeSearch")} />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="mx-auto flex size-10 items-center justify-center rounded-xl bg-muted mb-3">
            <CalendarDays className="size-5 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium">{t("noLeave")}</p>
        </div>
      ) : (
        <div className="rounded-xl border bg-card divide-y">
          {filtered.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-4 px-4 py-3 flex-wrap">
              <div className="min-w-0">
                <p className="text-sm font-medium [overflow-wrap:anywhere]"><BidiText>{r.employee?.name || t("unknown")}</BidiText></p>
                <p className="text-xs text-muted-foreground">
                  {t.rich("leaveSummary", { em: (chunks) => <BidiText>{chunks}</BidiText>, code: (chunks) => <IdentifierText>{chunks}</IdentifierText>,  policy: r.policy?.name || "-", start: r.startDate, end: r.endDate, hours: String(r.hours)  })}
                </p>
                {r.reason && <p className="text-xs text-muted-foreground mt-0.5"><BidiText>{r.reason}</BidiText></p>}
              </div>
              <div className="flex items-center gap-2 shrink-0 flex-wrap">
                <Badge variant="outline" className={cn("text-[10px]", statusColors[r.status] || "")}>
                  {t(r.status)}
                </Badge>
                {r.status === "pending" && (
                  <>
                    <Button size="sm" variant="outline" className=" text-xs h-auto min-h-8 max-w-full whitespace-normal py-1.5 [overflow-wrap:anywhere]" onClick={() => handleApprove(r.id)}>{t("approve")}</Button>
                    <Button size="sm" variant="outline" className=" text-xs text-red-600 h-auto min-h-8 max-w-full whitespace-normal py-1.5 [overflow-wrap:anywhere]" onClick={() => handleReject(r.id)}>{t("reject")}</Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("newLeave")}</DialogTitle></DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2 [&>*]:min-w-0">
            <div className="space-y-2">
              <Label htmlFor="payroll-leave-1" >{t("employee")}</Label>
              <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm" value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })} id="payroll-leave-1" aria-label={t("employee")} >
                <option value="">{t("select")}</option>
                {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="payroll-leave-2" >{t("policy")}</Label>
              <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm" value={form.policyId} onChange={(e) => setForm({ ...form, policyId: e.target.value })} id="payroll-leave-2" aria-label={t("policy")} >
                <option value="">{t("select")}</option>
                {policies.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="payroll-leave-3" >{t("startDate")}</Label>
              <Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} dir="ltr" id="payroll-leave-3" aria-label={t("startDate")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="payroll-leave-4" >{t("endDate")}</Label>
              <Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} dir="ltr" id="payroll-leave-4" aria-label={t("endDate")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="payroll-leave-5" >{t("hours")}</Label>
              <Input type="number" step="0.5" value={form.hours} onChange={(e) => setForm({ ...form, hours: e.target.value })} dir="ltr" id="payroll-leave-5" aria-label={t("hours")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="payroll-leave-6" >{t("reason")}</Label>
              <Input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} dir="auto" id="payroll-leave-6" aria-label={t("reason")} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="h-auto min-h-8 max-w-full whitespace-normal py-1.5 [overflow-wrap:anywhere]" >{t("cancel")}</Button>
            <Button onClick={handleCreate} disabled={creating} className="bg-emerald-600 hover:bg-emerald-700 h-auto min-h-8 max-w-full whitespace-normal py-1.5 [overflow-wrap:anywhere]">
              {creating ? t("creating") : t("submitRequest")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ContentReveal>
  );
}
