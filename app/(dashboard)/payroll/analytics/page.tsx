"use client";

import { useTranslations } from "next-intl";
import { payrollAnalyticsJson, analyticsOrganization } from "@/i18n/payroll-analytics-presentation";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { toast } from "sonner";
import {
  BarChart3,
  FileText,
  DollarSign,
  TrendingUp,
  Download,
  Users,
  Calculator,
} from "lucide-react";
import { useTopbarAction } from "@/components/dashboard/topbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ContentReveal } from "@/components/ui/content-reveal";
import { BrandLoader } from "@/components/dashboard/brand-loader";
import { payrollCentsInput } from "@/lib/money/payroll-input";
import { payrollMoneyDisplay as formatMoney } from "@/lib/money/payroll-display";
import { downloadPayrollCsv } from "@/lib/payroll/output-client";
import { useDocumentTitle } from "@/lib/hooks/use-document-title";
import { cn } from "@/lib/utils";

/* ---------- types ---------- */

interface Summary {
  currency: string;
  totalRuns: number;
  totalGross: number;
  totalDeductions: number;
  totalNet: number;
  activeEmployees: number;
  avgCostPerRun: number;
}

interface Projection {
  currency: string;
  month: string;
  gross: number;
  tax: number;
  net: number;
  headcount: number;
}

interface WhatIfResult {
  currency: string;
  current: { monthlyGross: number; projectedTotal: number; headcount: number };
  projected: { monthlyGross: number; projectedTotal: number; headcount: number };
  difference: { monthlyGross: number; projectedTotal: number };
}

/* ---------- helpers ---------- */

const anim = (delay: number) => ({
  initial: { opacity: 0, y: 12 } as const,
  animate: { opacity: 1, y: 0 } as const,
  transition: { duration: 0.3, delay } as const,
});

const REPORT_TYPES = [
  { type: "summary", label: "summary", description: "summaryDescription", icon: BarChart3 },
  { type: "tax-liability", label: "taxTitle", description: "taxDescription", icon: FileText },
  { type: "labor-cost", label: "laborTitle", description: "laborDescription", icon: DollarSign },
  { type: "yoy", label: "yoyTitle", description: "yoyDescription", icon: TrendingUp },
] as const;

const GHOST_ROWS = Array.from({ length: 6 }, (_, i) => i);

/* ---------- component ---------- */

export default function AnalyticsPage() {
  const t = useTranslations("PayrollAnalytics");
  const router = useRouter();

  const [summary, setSummary] = useState<Summary | null>(null);
  const [projection, setProjection] = useState<Projection[]>([]);
  const [loading, setLoading] = useState(true);
  const [moneyError, setMoneyError] = useState<string | null>(null);

  const [whatIf, setWhatIf] = useState<WhatIfResult | null>(null);
  const [whatIfLoading, setWhatIfLoading] = useState(false);

  // What-if form state
  const [salaryAdj, setSalaryAdj] = useState("0");
  const [newHires, setNewHires] = useState("0");
  const [avgHireSalary, setAvgHireSalary] = useState("60000");
  const [terminations, setTerminations] = useState("0");
  useDocumentTitle(t("analyticsDocumentTitle"));

  const orgId = analyticsOrganization();

  useEffect(() => {
    let active = true;
    // Start the asynchronous read together with its loading/error lifecycle.
    void Promise.resolve().then(async () => {
      if (!active) return;
      if (!orgId) throw new Error("Missing organization");
      setLoading(true);
      const headers = { "x-organization-id": orgId };
      await Promise.all([
        fetch("/api/v1/payroll/reports/summary", { headers }).then(r => payrollAnalyticsJson(r, "summary")),
        fetch("/api/v1/payroll/forecasting/projection?months=12", { headers }).then(r => payrollAnalyticsJson(r, "projection")),
      ]).then(([summaryRes, projRes]) => {
        if (!active) return;
        setSummary(summaryRes.summary); setProjection(projRes.data); setMoneyError(null);
      });
    }).catch(() => { if (active) setMoneyError(t(orgId ? "loadFailed" : "organizationRequired")); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [orgId, t]);

  const handleExport = useCallback(() => {
    if (!orgId) return;
    void downloadPayrollCsv(orgId).catch(() => toast.error(t("exportFailed")));
  }, [orgId, t]);

  async function handleWhatIf() {
    if (!orgId) return;
    setWhatIfLoading(true);
    try {
      const res = await fetch("/api/v1/payroll/forecasting/what-if", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-organization-id": orgId },
        body: JSON.stringify({
          salaryAdjustmentPercent: parseFloat(salaryAdj),
          newHires: parseInt(newHires),
          avgNewHireSalaryMinor: payrollCentsInput(avgHireSalary),
          terminations: parseInt(terminations),
          months: 12,
        }),
      });
      const data = await payrollAnalyticsJson(res, "scenario");
      setWhatIf(data);
    } catch {
      setWhatIf(null); toast.error(t("scenarioFailed"));
    } finally {
      setWhatIfLoading(false);
    }
  }

  useTopbarAction(
    useMemo(
      () => (
        <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={handleExport}>
          <Download className="size-3" /> {t("exportCsv")}
        </Button>
      ),
      [handleExport, t]
    )
  );

  if (loading) return <BrandLoader />;
  if (moneyError) return <p role="alert">{moneyError}</p>;

  const hasData = summary && summary.totalRuns > 0;

  return (
    <ContentReveal className="space-y-8">
      {/* Empty state */}
      {!hasData && (
        <>
          <motion.div
            {...anim(0.1)}
            className="relative overflow-hidden rounded-2xl border-2 border-dashed"
          >
            <div className="relative flex flex-col items-center justify-center py-20 px-6 text-center">
              {/* Animated icons */}
              <div className="relative mb-6">
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.5, delay: 0.3 }}
                  className="flex size-16 items-center justify-center rounded-2xl bg-muted ring-4 ring-muted/50"
                >
                  <BarChart3 className="size-8 text-foreground" />
                </motion.div>
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ duration: 0.4, delay: 0.5 }}
                  className="absolute -top-2 -right-3 flex size-8 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-950/60 ring-2 ring-blue-100/50 dark:ring-blue-900/30"
                >
                  <TrendingUp className="size-4 text-blue-600 dark:text-blue-400" />
                </motion.div>
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ duration: 0.4, delay: 0.6 }}
                  className="absolute -bottom-1 -left-3 flex size-7 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-950/60 ring-2 ring-amber-100/50 dark:ring-amber-900/30"
                >
                  <DollarSign className="size-3.5 text-amber-600 dark:text-amber-400" />
                </motion.div>
              </div>

              <motion.h3 {...anim(0.4)} className="text-lg font-semibold">
                {t("noAnalytics")}
              </motion.h3>
              <motion.p
                {...anim(0.45)}
                className="mt-2 max-w-md text-sm text-muted-foreground leading-relaxed"
              >
                {t("noAnalyticsDescription")}
              </motion.p>

              <motion.div {...anim(0.55)} className="mt-8">
                <Button
                  onClick={() => router.push("/payroll/runs")}
                  size="lg"
                  className="bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-600/20"
                >
                  {t("goToRuns")}
                </Button>
              </motion.div>
            </div>
          </motion.div>

          {/* Report type preview cards */}
          <motion.div {...anim(0.5)} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {REPORT_TYPES.map((report, i) => (
              <div
                key={report.type}
                className="flex items-start gap-4 rounded-xl border border-dashed border-muted-foreground/15 bg-card/30 p-4"
                style={{ opacity: 0.7 - i * 0.1 }}
              >
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted/40">
                  <report.icon className="size-5 text-muted-foreground/50" />
                </div>
                <div className="space-y-1.5">
                  <div className="h-3.5 w-24 rounded bg-muted/40" />
                  <div className="h-3 w-40 rounded bg-muted/30" />
                </div>
              </div>
            ))}
          </motion.div>

          {/* Ghost forecast rows */}
          <motion.div {...anim(0.6)} className="space-y-2">
            <div className="h-3.5 w-20 rounded bg-muted/40 mb-3" />
            <div className="rounded-xl border border-dashed border-muted-foreground/15 divide-y divide-dashed divide-muted-foreground/10">
              {GHOST_ROWS.slice(0, 4).map((i) => (
                <div
                  key={i}
                  className="flex items-center gap-4 px-4 py-3"
                  style={{ opacity: 1 - i * 0.2 }}
                >
                  <div className="h-3 w-20 rounded bg-muted/40" />
                  <div className="ml-auto h-3 w-16 rounded bg-muted/30" />
                  <div className="h-3 w-16 rounded bg-muted/30" />
                </div>
              ))}
            </div>
          </motion.div>
        </>
      )}

      {/* Summary stat cards */}
      {hasData && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <motion.div {...anim(0)} className="rounded-xl border bg-card p-4">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{t("totalRuns")}</p>
            <p className="mt-1 text-2xl font-bold font-mono tabular-nums">{summary.totalRuns}</p>
          </motion.div>
          <motion.div {...anim(0.05)} className="rounded-xl border bg-card p-4">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{t("totalGross")}</p>
            <p className="mt-1 text-2xl font-bold font-mono tabular-nums">{formatMoney(summary.totalGross, summary.currency)}</p>
          </motion.div>
          <motion.div {...anim(0.1)} className="rounded-xl border bg-card p-4">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{t("totalNet")}</p>
            <p className="mt-1 text-2xl font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
              {formatMoney(summary.totalNet, summary.currency)}
            </p>
          </motion.div>
          <motion.div {...anim(0.15)} className="rounded-xl border bg-card p-4">
            <div className="flex items-center gap-1.5">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{t("activeEmployees")}</p>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                <Users className="mr-0.5 size-2.5" />
                {t("live")}
              </Badge>
            </div>
            <p className="mt-1 text-2xl font-bold font-mono tabular-nums">{summary.activeEmployees}</p>
          </motion.div>
        </div>
      )}

      {/* Section 1: Reports */}
      {hasData && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold">{t("reports")}</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {REPORT_TYPES.map((report, i) => (
              <motion.button
                key={report.type}
                {...anim(0.2 + i * 0.05)}
                onClick={() => router.push(`/payroll/reports/${report.type}`)}
                className="flex items-start gap-4 rounded-xl border bg-card p-4 text-left hover:bg-muted/50 transition-colors"
              >
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <report.icon className="size-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium">{t(report.label)}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{t(report.description)}</p>
                </div>
              </motion.button>
            ))}
          </div>
        </div>
      )}

      {/* Section 2: 12-Month Forecast */}
      {hasData && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold">{t("forecast")}</h2>

          {projection.length > 0 ? (
            <div className="rounded-xl border bg-card divide-y">
              <div className="px-4 py-2.5 flex items-center justify-between bg-muted/50 rounded-t-xl">
                <span className="text-xs font-medium text-muted-foreground">{t("month")}</span>
                <div className="flex gap-6">
                  <span className="text-xs font-medium text-muted-foreground w-24 text-right">{t("gross")}</span>
                  <span className="text-xs font-medium text-muted-foreground w-24 text-right">{t("net")}</span>
                </div>
              </div>
              {projection.map((p) => (
                <div key={p.month} className="px-4 py-2 flex items-center justify-between">
                  <span className="text-sm font-mono">{p.month}</span>
                  <div className="flex gap-6">
                    <span className="text-sm font-mono tabular-nums w-24 text-right">{formatMoney(p.gross, p.currency)}</span>
                    <span className="text-sm font-mono tabular-nums w-24 text-right">{formatMoney(p.net, p.currency)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed bg-card/50 p-6 text-center">
              <p className="text-xs text-muted-foreground">{t("noForecast")}</p>
            </div>
          )}
        </div>
      )}

      {/* Section 3: What-If Analysis */}
      {hasData && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold">{t("whatIf")}</h2>
          <div className="rounded-xl border bg-card p-4 space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="space-y-1">
                <Label className="text-xs">{t("salaryAdjustment")}</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={salaryAdj}
                  onChange={(e) => setSalaryAdj(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t("newHires")}</Label>
                <Input
                  type="number"
                  value={newHires}
                  onChange={(e) => setNewHires(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t("avgHireSalary")}</Label>
                <CurrencyInput
                  prefix={summary?.currency ?? "USD"}
                  size="sm"
                  value={avgHireSalary}
                  onChange={setAvgHireSalary}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t("terminations")}</Label>
                <Input
                  type="number"
                  value={terminations}
                  onChange={(e) => setTerminations(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
            </div>
            <Button size="sm" onClick={handleWhatIf} disabled={whatIfLoading}>
              <Calculator className="mr-1.5 size-3" />
              {whatIfLoading ? t("calculating") : t("runScenario")}
            </Button>
          </div>

          {whatIf && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <motion.div {...anim(0)} className="rounded-xl border bg-card p-4">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{t("currentMonthly")}</p>
                <p className="mt-1 text-xl font-bold font-mono tabular-nums">{formatMoney(whatIf.current.monthlyGross, whatIf.currency)}</p>
                <p className="text-xs text-muted-foreground">{t("employeesCount", { count: whatIf.current.headcount })}</p>
              </motion.div>
              <motion.div {...anim(0.05)} className="rounded-xl border bg-card p-4">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{t("projectedMonthly")}</p>
                <p className="mt-1 text-xl font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                  {formatMoney(whatIf.projected.monthlyGross, whatIf.currency)}
                </p>
                <p className="text-xs text-muted-foreground">{t("employeesCount", { count: whatIf.projected.headcount })}</p>
              </motion.div>
              <motion.div {...anim(0.1)} className="rounded-xl border bg-card p-4">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{t("difference")}</p>
                <p
                  className={cn(
                    "mt-1 text-xl font-bold font-mono tabular-nums",
                    whatIf.difference.monthlyGross >= 0
                      ? "text-red-600 dark:text-red-400"
                      : "text-emerald-600 dark:text-emerald-400"
                  )}
                >
                  {whatIf.difference.monthlyGross >= 0 ? "+" : ""}
                  {formatMoney(whatIf.difference.monthlyGross, whatIf.currency)}
                </p>
                <p className="text-xs text-muted-foreground">{t("perMonth")}</p>
              </motion.div>
            </div>
          )}
        </div>
      )}
    </ContentReveal>
  );
}
