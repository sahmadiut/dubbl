"use client";

import { usePresentation } from "@/i18n/provider";
import { executiveSummaryUi, analyticalReportJson, analyticalAbs } from "@/lib/money/analytical-report-ui";
import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { BrandLoader } from "@/components/dashboard/brand-loader";
import { ContentReveal } from "@/components/ui/content-reveal";
import { PageHeader } from "@/components/dashboard/page-header";
import { DateRangeFilter } from "@/components/dashboard/date-range-filter";
import { analyticalMoney as statementMoneyText } from "@/lib/money/analytical-report-ui";
import { cn } from "@/lib/utils";
import { BackToReports, ReportHelp, BasisToggle } from "../_components";

type Kpi = ReturnType<typeof executiveSummaryUi>["kpis"][number];

/** Only known report keys are translated; unknown API labels remain data. */
const KPI_LABEL_KEYS = {
  revenue: "kpiRevenue",
  grossProfit: "kpiGrossProfit",
  expenses: "kpiExpenses",
  netIncome: "kpiNetIncome",
  cash: "kpiCash",
  accountsReceivable: "kpiReceivable",
  accountsPayable: "kpiPayable",
} as const;

export default function ExecutiveSummaryPage() {
  const presentation = usePresentation();
  const t = useTranslations("IncomeReports");
  const now = new Date();
  const [initialLoad, setInitialLoad] = useState(true);
  const [loading, setLoading] = useState(true);
  const [currencyCode, setCurrencyCode] = useState("USD");
  const [error, setError] = useState(false);
  const [startDate, setStartDate] = useState(`${now.getFullYear()}-01-01`);
  const [endDate, setEndDate] = useState(now.toISOString().slice(0, 10));
  const [basis, setBasis] = useState<"accrual" | "cash">("accrual");
  const [kpis, setKpis] = useState<Kpi[]>([]);
  const [priorPeriod, setPriorPeriod] = useState<{ startDate: string; endDate: string } | null>(null);

  useEffect(() => {
    const orgId = localStorage.getItem("activeOrgId");
    if (!orgId) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    const params = new URLSearchParams({ startDate, endDate, basis });
    fetch(`/api/v1/reports/executive-summary?${params}`, {
      headers: { "x-organization-id": orgId },
    })
      .then((r) => analyticalReportJson(r, executiveSummaryUi))
      .then((data) => {
        if (cancelled) return;
        setCurrencyCode(data.currencyCode);
        setError(false);
        setKpis(data.kpis || []);
        setPriorPeriod(data.priorPeriod || null);
      })
      .catch(() => {
        if (!cancelled) { setKpis([]); setPriorPeriod(null); setError(true); }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
          setInitialLoad(false);
        }
      });
    return () => { cancelled = true; };
  }, [startDate, endDate, basis]);

  if (initialLoad) return <BrandLoader />;

  return (
    <ContentReveal className="space-y-6">
      <BackToReports />

      <PageHeader
        title={t("executiveTitle")}
        description={t("executiveDescription")}
      >
        <a
          href={`/api/v1/reports/executive-summary?${new URLSearchParams({ startDate, endDate, basis, format: "pdf" })}`}
          className="inline-flex h-8 items-center rounded-md border px-3 text-sm font-medium hover:bg-muted"
        >
          {t("downloadPdf")}
        </a>
      </PageHeader>

      <ReportHelp>
        {t("executiveHelp")}
      </ReportHelp>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <DateRangeFilter
          startDate={startDate}
          endDate={endDate}
          onDateChange={(s, e) => { setStartDate(s); setEndDate(e); }}
        />
        <BasisToggle basis={basis} onChange={setBasis} />
      </div>

      {loading ? (
        <BrandLoader className="h-48" />
      ) : error ? (
        <p role="alert" className="text-sm text-red-600">{t("loadFailed")}</p>
      ) : (
        <ContentReveal>
          {priorPeriod && (
            <p className="mb-3 text-[13px] text-muted-foreground">
              {t("priorPeriod", { start: priorPeriod.startDate, end: priorPeriod.endDate })}
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {kpis.map((k) => {
              const up = k.delta > 0;
              const down = k.delta < 0;
              const Icon = up ? TrendingUp : down ? TrendingDown : Minus;
              return (
                <div key={k.key} className="rounded-xl border bg-card/80 p-4 sm:p-5">
                  <p className="text-xs font-medium text-muted-foreground">
                    {Object.hasOwn(KPI_LABEL_KEYS, k.key) ? t(KPI_LABEL_KEYS[k.key as keyof typeof KPI_LABEL_KEYS]) : k.label}
                  </p>
                  <p className="mt-1.5 text-xl sm:text-2xl font-bold font-mono tabular-nums">
                    {statementMoneyText(k.current, currencyCode, presentation)}
                  </p>
                  <div className="mt-2 flex items-center gap-1.5 text-xs">
                    <Icon className={cn("size-3.5", up && "text-emerald-600", down && "text-red-600", !up && !down && "text-muted-foreground")} />
                    <span className={cn("font-medium", up && "text-emerald-600", down && "text-red-600", !up && !down && "text-muted-foreground")}>
                      {k.delta >= 0 ? "+" : "-"}{statementMoneyText(analyticalAbs(k.delta), currencyCode, presentation)}
                      {k.deltaPercent !== null && t("deltaPercent", { sign: k.deltaPercent >= 0 ? "+" : "", value: String(k.deltaPercent) })}
                    </span>
                    <span className="text-muted-foreground">{t("vsLastPeriod")}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </ContentReveal>
      )}
    </ContentReveal>
  );
}
