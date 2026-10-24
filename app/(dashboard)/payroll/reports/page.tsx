"use client";
import { usePresentation as useUnitPresentation } from "@/i18n/provider";

import { useTranslations } from "next-intl";
import { payrollAnalyticsJson, analyticsOrganization } from "@/i18n/payroll-analytics-presentation";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { motion } from "motion/react";
import { BarChart3, FileText, DollarSign, TrendingUp, Download } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { ContentReveal } from "@/components/ui/content-reveal";
import { BrandLoader } from "@/components/dashboard/brand-loader";
import { payrollMoneyDisplay as formatMoney } from "@/lib/money/payroll-display";
import { downloadPayrollCsv } from "@/lib/payroll/output-client";
import { useDocumentTitle } from "@/lib/hooks/use-document-title";

interface Summary {
  currency: string;
  totalRuns: number;
  totalGross: number;
  totalDeductions: number;
  totalNet: number;
  activeEmployees: number;
  avgCostPerRun: number;
}

const anim = (delay: number) => ({
  initial: { opacity: 0, y: 12 } as const,
  animate: { opacity: 1, y: 0 } as const,
  transition: { duration: 0.3, delay } as const,
});

const REPORT_TYPES = [
  { type: "summary", label: "summaryTitle", description: "summaryDescription", icon: BarChart3 },
  { type: "tax-liability", label: "taxTitle", description: "taxDescription", icon: FileText },
  { type: "labor-cost", label: "laborTitle", description: "laborDescription", icon: DollarSign },
  { type: "yoy", label: "yoyTitle", description: "yoyDescription", icon: TrendingUp },
] as const;

export default function ReportsPage() {
  const unitPresentation = useUnitPresentation();
  const t = useTranslations("PayrollAnalytics");
  const router = useRouter();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [moneyError, setMoneyError] = useState<string | null>(null);

  const orgId = analyticsOrganization();
  useDocumentTitle(t("reportsDocumentTitle"));

  useEffect(() => {
    let active = true;
    // Start the asynchronous read together with its loading/error lifecycle.
    void Promise.resolve().then(async () => {
      if (!active) return;
      if (!orgId) throw new Error("Missing organization");
      setLoading(true);
      const headers = { "x-organization-id": orgId };
      await fetch("/api/v1/payroll/reports/summary", { headers })
        .then(r => payrollAnalyticsJson(r, "summary"))
        .then(data => { if (active) { setSummary(data.summary); setMoneyError(null); } });
    }).catch(() => { if (active) setMoneyError(t(orgId ? "loadFailed" : "organizationRequired")); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [orgId, t]);

  function handleExport() {
    if (!orgId) return;
    void downloadPayrollCsv(orgId).catch(() => toast.error(t("exportFailed")));
  }

  if (loading) return <BrandLoader />;
  if (moneyError) return <p role="alert">{moneyError}</p>;

  return (
    <ContentReveal className="space-y-6">
      <PageHeader title={t("reportsTitle")} description={t("reportsDescription")}>
        <Button size="sm" variant="outline" className="h-8 text-xs" onClick={handleExport}>
          <Download className="mr-1.5 size-3" /> {t("exportCsv")}
        </Button>
      </PageHeader>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <motion.div {...anim(0)} className="rounded-xl border bg-card p-4">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{t("totalRuns")}</p>
            <p className="mt-1 text-2xl font-bold font-mono tabular-nums">{summary.totalRuns}</p>
          </motion.div>
          <motion.div {...anim(0.05)} className="rounded-xl border bg-card p-4">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{t("totalGross")}</p>
            <p className="mt-1 text-2xl font-bold font-mono tabular-nums">{formatMoney(summary.totalGross, summary.currency, unitPresentation)}</p>
          </motion.div>
          <motion.div {...anim(0.1)} className="rounded-xl border bg-card p-4">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{t("totalNet")}</p>
            <p className="mt-1 text-2xl font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">{formatMoney(summary.totalNet, summary.currency, unitPresentation)}</p>
          </motion.div>
          <motion.div {...anim(0.15)} className="rounded-xl border bg-card p-4">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{t("avgCostPerRun")}</p>
            <p className="mt-1 text-2xl font-bold font-mono tabular-nums">{formatMoney(summary.avgCostPerRun, summary.currency, unitPresentation)}</p>
          </motion.div>
        </div>
      )}

      {/* Report type cards */}
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
    </ContentReveal>
  );
}
