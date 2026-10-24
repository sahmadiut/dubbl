"use client";

import { usePresentation } from "@/i18n/provider";
import { financialRatiosUi, analyticalReportJson } from "@/lib/money/analytical-report-ui";
import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { BackToReports } from "../_components";
import { Gauge } from "lucide-react";
import { BrandLoader } from "@/components/dashboard/brand-loader";
import { ContentReveal } from "@/components/ui/content-reveal";
import { PageHeader } from "@/components/dashboard/page-header";
import { DateRangeFilter } from "@/components/dashboard/date-range-filter";
import { analyticalMoney as formatMoney } from "@/lib/money/analytical-report-ui";
import { cn } from "@/lib/utils";

type Ratios = ReturnType<typeof financialRatiosUi>["ratios"];

type Balances = ReturnType<typeof financialRatiosUi>["balances"];

const ratioInfo = {
  currentRatio: {
    label: "currentRatioLabel",
    description: "currentRatioDescription",
    format: (v: string) => `${v}x`,
    goodWhen: (v: number) => v >= 1,
  },
  quickRatio: {
    label: "quickRatioLabel",
    description: "quickRatioDescription",
    format: (v: string) => `${v}x`,
    goodWhen: (v: number) => v >= 1,
  },
  debtToEquity: {
    label: "debtToEquityLabel",
    description: "debtToEquityDescription",
    format: (v: string) => `${v}x`,
    goodWhen: (v: number) => v <= 2,
  },
  grossMargin: {
    label: "grossMarginLabel",
    description: "grossMarginDescription",
    format: (v: string) => `${v}%`,
    goodWhen: (v: number) => v > 0,
  },
  netMargin: {
    label: "netMarginLabel",
    description: "netMarginDescription",
    format: (v: string) => `${v}%`,
    goodWhen: (v: number) => v > 0,
  },
  dso: {
    label: "dsoLabel",
    description: "dsoDescription",
    format: (v: string) => v,
    goodWhen: (v: number) => v <= 45,
  },
  dpo: {
    label: "dpoLabel",
    description: "dpoDescription",
    format: (v: string) => v,
    goodWhen: (v: number) => v <= 60,
  },
  returnOnAssets: {
    label: "returnOnAssetsLabel",
    description: "returnOnAssetsDescription",
    format: (v: string) => `${v}%`,
    goodWhen: (v: number) => v > 0,
  },
  returnOnEquity: {
    label: "returnOnEquityLabel",
    description: "returnOnEquityDescription",
    format: (v: string) => `${v}%`,
    goodWhen: (v: number) => v > 0,
  },
} as const;

export default function FinancialRatiosPage() {
  const presentation = usePresentation();
  const t = useTranslations("AnalyticalReports");
  const now = new Date();
  const [initialLoad, setInitialLoad] = useState(true);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(`${now.getFullYear()}-01-01`);
  const [endDate, setEndDate] = useState(now.toISOString().slice(0, 10));
  const [ratios, setRatios] = useState<Ratios | null>(null);
  const [balances, setBalances] = useState<Balances | null>(null);
  const [ratiosExact, setRatiosExact] = useState<ReturnType<typeof financialRatiosUi>["ratiosExact"] | null>(null);
  const [currencyCode, setCurrencyCode] = useState("USD");
  const [error, setError] = useState(false);

  useEffect(() => {
    const orgId = localStorage.getItem("activeOrgId");
    if (!orgId) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    const params = new URLSearchParams({ startDate, endDate });
    fetch(`/api/v1/reports/financial-ratios?${params}`, {
      headers: { "x-organization-id": orgId },
    })
      .then((r) => analyticalReportJson(r, financialRatiosUi))
      .then((data) => {
        if (cancelled) return;
        setRatios(data.ratios);
        setRatiosExact(data.ratiosExact);
        setCurrencyCode(data.currencyCode);
        setError(false);
        setBalances(data.balances);
      })
      .catch(() => { if (!cancelled) { setRatios(null); setBalances(null); setRatiosExact(null); setError(true); } })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
          setInitialLoad(false);
        }
      });
    return () => { cancelled = true; };
  }, [startDate, endDate]);

  if (initialLoad) return <BrandLoader />;

  return (
    <ContentReveal className="space-y-6">
      <BackToReports />

      <PageHeader
        title={t("ratiosTitle")}
        description={t("ratiosDescription")}
      />

      <DateRangeFilter
        startDate={startDate}
        endDate={endDate}
        onDateChange={(s, e) => { setStartDate(s); setEndDate(e); }}
      />

      {loading ? (
        <BrandLoader className="h-48" />
      ) : error ? <p role="alert" className="text-sm text-destructive">{t("loadFailed")}</p> : !ratios ? (
        <ContentReveal>
          <div className="rounded-xl border border-dashed py-12 text-center">
            <p className="text-sm text-muted-foreground">{t("noFinancialData")}</p>
          </div>
        </ContentReveal>
      ) : (
        <ContentReveal>
          {/* Ratio Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(ratioInfo).map(([key, info]) => {
              const value = ratios[key as keyof Ratios];
              if (value === null) return null;
              const good = info.goodWhen(value);
              return (
                <div key={key} className="rounded-lg border p-4 space-y-1">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t(info.label)}</p>
                    <Gauge className="size-3.5 text-muted-foreground/50" />
                  </div>
                  <p className={cn(
                    "text-2xl font-bold font-mono tabular-nums truncate",
                    good ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                  )}>
                    {key === "dso" || key === "dpo" ? t("ratioDays", { value: ratiosExact![key]! }) : info.format(ratiosExact![key as keyof Ratios]!)}
                  </p>
                  <p className="text-[11px] text-muted-foreground leading-tight">{t(info.description)}</p>
                </div>
              );
            })}
          </div>

          {/* Underlying Balances */}
          {balances && (
            <div className="mt-4">
              <p className="text-sm font-medium mb-3">{t("underlyingBalances")}</p>
              <div className="rounded-lg border overflow-hidden">
                <table className="w-full text-sm">
                  <tbody>
                    {([
                      ["totalAssets", balances.totalAssets],
                      ["currentAssets", balances.currentAssets],
                      ["inventory", balances.inventory],
                      ["totalLiabilities", balances.totalLiabilities],
                      ["currentLiabilities", balances.currentLiabilities],
                      ["totalEquity", balances.totalEquity],
                      ["periodRevenue", balances.totalRevenue],
                      ["periodExpenses", balances.totalExpenses],
                      ["periodNetIncome", balances.netIncome],
                      ["receivablesDue", balances.receivablesDue],
                      ["payablesDue", balances.payablesDue],
                    ] as const).map(([label, value]) => (
                      <tr key={label} className="border-b last:border-b-0">
                        <td className="px-4 py-2 text-muted-foreground">{t(label)}</td>
                        <td className="px-4 py-2 text-right font-mono tabular-nums font-medium">
                          {formatMoney(value, currencyCode, presentation)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </ContentReveal>
      )}
    </ContentReveal>
  );
}
