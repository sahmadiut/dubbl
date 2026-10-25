"use client";

import { BidiText, IdentifierText } from "@/components/ui/bidi-text";
import { usePresentation as useUnitPresentation } from "@/i18n/provider";

import { useTranslations } from "next-intl";
import { payrollAnalyticsJson, analyticsOrganization } from "@/i18n/payroll-analytics-presentation";

import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { toast } from "sonner";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Label } from "@/components/ui/label";
import { ContentReveal } from "@/components/ui/content-reveal";
import { BrandLoader } from "@/components/dashboard/brand-loader";
import { useDocumentTitle } from "@/lib/hooks/use-document-title";
import { payrollMoneyDisplay as formatMoney } from "@/lib/money/payroll-display";
import { payrollCentsInput } from "@/lib/money/payroll-input";

interface Projection {
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

const anim = (delay: number) => ({
  initial: { opacity: 0, y: 12 } as const,
  animate: { opacity: 1, y: 0 } as const,
  transition: { duration: 0.3, delay } as const,
});

export default function ForecastingPage() {
  const unitPresentation = useUnitPresentation();
  const t = useTranslations("PayrollAnalytics");
  const [projection, setProjection] = useState<Projection[]>([]);
  const [loading, setLoading] = useState(true);
  const [moneyError, setMoneyError] = useState<string | null>(null);
  const [currency, setCurrency] = useState("USD");
  const [totals, setTotals] = useState({ gross: 0, net: 0 });
  const [whatIf, setWhatIf] = useState<WhatIfResult | null>(null);
  const [whatIfLoading, setWhatIfLoading] = useState(false);

  // What-if form
  const [salaryAdj, setSalaryAdj] = useState("0");
  const [newHires, setNewHires] = useState("0");
  const [avgHireSalary, setAvgHireSalary] = useState("60000");
  const [terminations, setTerminations] = useState("0");

  const orgId = analyticsOrganization();
  useDocumentTitle(t("forecastDocumentTitle"));

  useEffect(() => {
    let active = true;
    // Start the asynchronous read together with its loading/error lifecycle.
    void Promise.resolve().then(async () => {
      if (!active) return;
      if (!orgId) throw new Error("Missing organization");
      setLoading(true);
      const headers = { "x-organization-id": orgId };
      await fetch("/api/v1/payroll/forecasting/projection?months=12", { headers })
        .then(r => payrollAnalyticsJson(r, "projection"))
        .then(data => {
          if (!active) return;
          setCurrency(data.currency); setTotals(data.totals); setProjection(data.data); setMoneyError(null);
        });
    }).catch(() => { if (active) setMoneyError(t(orgId ? "loadFailed" : "organizationRequired")); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [orgId, t]);

  async function handleWhatIf() {
    if (!orgId) return;
    setWhatIfLoading(true);
    try {
      const res = await fetch("/api/v1/payroll/forecasting/what-if", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-organization-id": orgId },
        body: JSON.stringify({
          salaryAdjustmentPercent: Number(salaryAdj),
          newHires: Number(newHires),
          avgNewHireSalaryMinor: payrollCentsInput(avgHireSalary),
          terminations: Number(terminations),
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

  if (loading) return <BrandLoader />;
  if (moneyError) return <p role="alert">{moneyError}</p>;

  const totalGross = totals.gross;
  const totalNet = totals.net;

  return (
    <ContentReveal className="space-y-6">
      <PageHeader title={t("forecastTitle")} description={t("forecastDescription")} />

      {/* Projection summary */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 [&>*]:min-w-0">
        <motion.div {...anim(0)} className="rounded-xl border bg-card p-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{t("yearGross")}</p>
          <p className="mt-1 text-2xl font-bold font-mono tabular-nums"><IdentifierText>{formatMoney(totalGross, currency, unitPresentation)}</IdentifierText></p>
        </motion.div>
        <motion.div {...anim(0.05)} className="rounded-xl border bg-card p-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{t("yearNet")}</p>
          <p className="mt-1 text-2xl font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400"><IdentifierText>{formatMoney(totalNet, currency, unitPresentation)}</IdentifierText></p>
        </motion.div>
        <motion.div {...anim(0.1)} className="rounded-xl border bg-card p-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{t("headcount")}</p>
          <p className="mt-1 text-2xl font-bold font-mono tabular-nums"><BidiText>{projection[0]?.headcount || 0}</BidiText></p>
        </motion.div>
      </div>

      {/* Monthly projection table */}
      {projection.length > 0 && (
        <div className="rounded-xl border bg-card divide-y">
          <div className="px-4 py-2.5 flex items-center justify-between bg-muted/50 rounded-t-xl flex-wrap">
            <span className="text-xs font-medium text-muted-foreground">{t("month")}</span>
            <div className="flex gap-6">
              <span className="text-xs font-medium text-muted-foreground w-24 text-end">{t("gross")}</span>
              <span className="text-xs font-medium text-muted-foreground w-24 text-end">{t("net")}</span>
            </div>
          </div>
          {projection.map((p) => (
            <div key={p.month} className="px-4 py-2 flex items-center justify-between flex-wrap">
              <span className="text-sm font-mono"><IdentifierText>{p.month}</IdentifierText></span>
              <div className="flex gap-6">
                <span className="text-sm font-mono tabular-nums w-24 text-end"><IdentifierText>{formatMoney(p.gross, currency, unitPresentation)}</IdentifierText></span>
                <span className="text-sm font-mono tabular-nums w-24 text-end"><IdentifierText>{formatMoney(p.net, currency, unitPresentation)}</IdentifierText></span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* What-if analysis */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold">{t("whatIf")}</h3>
        <div className="rounded-lg border p-4 space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 [&>*]:min-w-0">
            <div className="space-y-1">
              <Label className="text-xs" htmlFor="payroll-forecasting-1" >{t("salaryAdjustment")}</Label>
              <Input type="number" step="0.1" value={salaryAdj} onChange={(e) => setSalaryAdj(e.target.value)} className="h-8 text-sm" dir="ltr" id="payroll-forecasting-1" aria-label={t("salaryAdjustment")} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs" htmlFor="payroll-forecasting-2" >{t("newHires")}</Label>
              <Input type="number" value={newHires} onChange={(e) => setNewHires(e.target.value)} className="h-8 text-sm" dir="ltr" id="payroll-forecasting-2" aria-label={t("newHires")} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs" htmlFor="payroll-forecasting-3" >{t("avgHireSalary")}</Label>
              <CurrencyInput prefix={currency} size="sm" value={avgHireSalary} onChange={setAvgHireSalary} id="payroll-forecasting-3" aria-label={t("avgHireSalary")} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs" htmlFor="payroll-forecasting-4" >{t("terminations")}</Label>
              <Input type="number" value={terminations} onChange={(e) => setTerminations(e.target.value)} className="h-8 text-sm" dir="ltr" id="payroll-forecasting-4" aria-label={t("terminations")} />
            </div>
          </div>
          <Button size="sm" onClick={handleWhatIf} disabled={whatIfLoading} className="h-auto min-h-8 max-w-full whitespace-normal py-1.5 [overflow-wrap:anywhere]" >
            {whatIfLoading ? t("calculating") : t("runScenario")}
          </Button>
        </div>

        {whatIf && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 [&>*]:min-w-0">
            <div className="rounded-xl border bg-card p-4">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{t("currentMonthly")}</p>
              <p className="mt-1 text-xl font-bold font-mono tabular-nums"><IdentifierText>{formatMoney(whatIf.current.monthlyGross, whatIf.currency, unitPresentation)}</IdentifierText></p>
              <p className="text-xs text-muted-foreground">{t("employeesCount", { count: whatIf.current.headcount })}</p>
            </div>
            <div className="rounded-xl border bg-card p-4">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{t("projectedMonthly")}</p>
              <p className="mt-1 text-xl font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400"><IdentifierText>{formatMoney(whatIf.projected.monthlyGross, whatIf.currency, unitPresentation)}</IdentifierText></p>
              <p className="text-xs text-muted-foreground">{t("employeesCount", { count: whatIf.projected.headcount })}</p>
            </div>
            <div className="rounded-xl border bg-card p-4">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{t("difference")}</p>
              <p className={`mt-1 text-xl font-bold font-mono tabular-nums ${whatIf.difference.monthlyGross >= 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                <IdentifierText>{whatIf.difference.monthlyGross >= 0 ? "+" : ""}{formatMoney(whatIf.difference.monthlyGross, whatIf.currency, unitPresentation)}</IdentifierText>
              </p>
              <p className="text-xs text-muted-foreground">{t("perMonth")}</p>
            </div>
          </div>
        )}
      </div>
    </ContentReveal>
  );
}
