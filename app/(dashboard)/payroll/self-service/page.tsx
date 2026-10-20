"use client";

import { useTranslations } from "next-intl";
import {
  payrollSelfServiceJson, payrollSelfServiceOrganization,
  type SelfProfile as Profile, type SelfPayslip as Payslip,
  type SelfLeaveBalance as LeaveBalance, type SelfTimesheet as Timesheet,
} from "@/i18n/payroll-self-service-presentation";

import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { toast } from "sonner";
import { User, Save } from "lucide-react";
import { Section } from "@/components/dashboard/section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ContentReveal } from "@/components/ui/content-reveal";
import { BrandLoader } from "@/components/dashboard/brand-loader";
import { payrollMoneyDisplay as formatMoney } from "@/lib/money/payroll-display";
import { useDocumentTitle } from "@/lib/hooks/use-document-title";

const anim = (delay: number) => ({
  initial: { opacity: 0, y: 12 } as const,
  animate: { opacity: 1, y: 0 } as const,
  transition: { duration: 0.3, delay } as const,
});

export default function SelfServicePage() {
  const t = useTranslations("PayrollSelfService");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [leaveBalances, setLeaveBalances] = useState<LeaveBalance[]>([]);
  const [timesheets, setTimesheets] = useState<Timesheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [moneyError, setMoneyError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [email, setEmail] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  useDocumentTitle(t("documentTitle"));

  const orgId = payrollSelfServiceOrganization();

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        if (!orgId) { if (active) setMoneyError("organizationRequired"); return; }
        const headers = { "x-organization-id": orgId };
        const response = await fetch("/api/v1/payroll/self-service/profile", { headers });
        if (!active) return;
        if (response.status === 404) { setProfile(null); setMoneyError(null); return; }
        const { employee } = await payrollSelfServiceJson(response, "profile");
        if (!active) return;
        const [slips, leave, sheets] = await Promise.all([
          fetch("/api/v1/payroll/self-service/payslips", { headers }).then(r => payrollSelfServiceJson(r, "payslips", employee.id)),
          fetch("/api/v1/payroll/self-service/leave-balance", { headers }).then(r => payrollSelfServiceJson(r, "leave", employee.id)),
          fetch("/api/v1/payroll/self-service/timesheets", { headers }).then(r => payrollSelfServiceJson(r, "timesheets", employee.id)),
        ]);
        if (!active) return;
        setProfile(employee); setEmail(employee.email || ""); setBankAccount(employee.bankAccountNumber || "");
        setPayslips(slips.data); setLeaveBalances(leave.data); setTimesheets(sheets.data); setMoneyError(null);
      } catch { if (active) setMoneyError("loadFailed"); }
      finally { if (active) setLoading(false); }
    }
    void load();
    return () => { active = false; };
  }, [orgId]);

  async function handleSaveProfile() {
    if (!orgId) { toast.error(t("organizationRequired")); return; }
    if (!profile) return;
    setSaving(true);
    try {
      const res = await fetch("/api/v1/payroll/self-service/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-organization-id": orgId },
        body: JSON.stringify({
          email: email || undefined,
          bankAccountNumber: bankAccount || undefined,
        }),
      });
      await payrollSelfServiceJson(res, "profile", profile.id);
      toast.success(t("profileUpdated"));
    } catch {
      toast.error(t("saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <BrandLoader />;
  if (moneyError) return <p role="alert">{t(moneyError === "organizationRequired" ? "organizationRequired" : "loadFailed")}</p>;

  if (!profile) {
    return (
      <ContentReveal className="space-y-6">
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="mx-auto flex size-10 items-center justify-center rounded-xl bg-muted mb-3">
            <User className="size-5 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium">{t("noProfile")}</p>
          <p className="text-xs text-muted-foreground mt-1">{t("noProfileDescription")}</p>
        </div>
      </ContentReveal>
    );
  }

  return (
    <ContentReveal className="space-y-6">
      {/* Quick stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <motion.div {...anim(0)} className="rounded-xl border bg-card p-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{t("employeeNumber")}</p>
          <p className="mt-1 text-lg font-bold font-mono">{profile.employeeNumber}</p>
        </motion.div>
        <motion.div {...anim(0.05)} className="rounded-xl border bg-card p-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{t("position")}</p>
          <p className="mt-1 text-lg font-bold truncate">{profile.position || "-"}</p>
        </motion.div>
        <motion.div {...anim(0.1)} className="rounded-xl border bg-card p-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{t("ptoBalance")}</p>
          <p className="mt-1 text-lg font-bold font-mono tabular-nums">{t("hours", { hours: String(profile.ptoBalanceHours) })}</p>
        </motion.div>
        <motion.div {...anim(0.15)} className="rounded-xl border bg-card p-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{t("payslips")}</p>
          <p className="mt-1 text-lg font-bold font-mono tabular-nums">{payslips.length}</p>
        </motion.div>
      </div>

      <div className="max-w-4xl space-y-6">
        {/* Profile edit */}
        <Section title={t("profileTitle")} description={t("profileDescription")}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">{t("email")}</Label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t("bankAccount")}</Label>
              <Input value={bankAccount} onChange={(e) => setBankAccount(e.target.value)} />
            </div>
          </div>
          <div className="mt-3 flex justify-end">
            <Button size="sm" onClick={handleSaveProfile} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
              <Save className="mr-1.5 size-3.5" /> {saving ? t("saving") : t("save")}
            </Button>
          </div>
        </Section>

        <div className="h-px bg-border" />

        {/* Payslips */}
        <Section title={t("payslipsTitle")} description={t("payslipsDescription")}>
          {payslips.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">{t("noPayslips")}</p>
          ) : (
            <div className="rounded-lg border divide-y">
              {payslips.slice(0, 10).map((ps) => (
                <div key={ps.id} className="flex items-center justify-between px-4 py-2.5">
                  <div>
                    <p className="text-sm">{t("period", { start: ps.payrollRun?.payPeriodStart ?? "", end: ps.payrollRun?.payPeriodEnd ?? "" })}</p>
                    <p className="text-xs text-muted-foreground">{new Date(ps.generatedAt).toLocaleDateString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-mono tabular-nums">{formatMoney(ps.grossAmount, ps.currency)}</p>
                    <p className="text-xs text-muted-foreground font-mono">{t("netAmount", { amount: formatMoney(ps.netAmount, ps.currency) })}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

        <div className="h-px bg-border" />

        {/* Leave Balances */}
        <Section title={t("leaveTitle")} description={t("leaveDescription")}>
          {leaveBalances.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">{t("noLeave")}</p>
          ) : (
            <div className="rounded-lg border divide-y">
              {leaveBalances.map((lb) => (
                <div key={lb.id} className="flex items-center justify-between px-4 py-2.5">
                  <div>
                    <p className="text-sm font-medium">{lb.policy?.name || "-"}</p>
                    <p className="text-xs text-muted-foreground">{lb.policy ? t(`leaveType_${lb.policy.leaveType}`) : null}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-mono tabular-nums">{t("hoursAvailable", { hours: String(lb.balance) })}</p>
                    <p className="text-xs text-muted-foreground">{t("hoursUsed", { hours: String(lb.usedHours) })}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

        <div className="h-px bg-border" />

        {/* Timesheets */}
        <Section title={t("timesheetsTitle")} description={t("timesheetsDescription")}>
          {timesheets.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">{t("noTimesheets")}</p>
          ) : (
            <div className="rounded-lg border divide-y">
              {timesheets.slice(0, 5).map((ts) => (
                <div key={ts.id} className="flex items-center justify-between px-4 py-2.5">
                  <div>
                    <p className="text-sm">{t("period", { start: ts.periodStart, end: ts.periodEnd })}</p>
                    <p className="text-xs text-muted-foreground">{t("hours", { hours: String(ts.totalHours) })}</p>
                  </div>
                  <Badge variant="outline" className="text-[10px]">{t(`status_${ts.status}`)}</Badge>
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>
    </ContentReveal>
  );
}
