"use client";
import { usePresentation as useUnitPresentation } from "@/i18n/provider";

import { useTranslations } from "next-intl";
import { crmAnalyticsJson, crmAnalyticsStageKeys, type CrmAnalytics } from "@/i18n/crm-analytics-presentation";

import { useState, useEffect } from "react";
import { BarChart3, Target, TrendingUp, DollarSign } from "lucide-react";
import { StatCard } from "@/components/dashboard/stat-card";
import { BrandLoader } from "@/components/dashboard/brand-loader";
import { ContentReveal } from "@/components/ui/content-reveal";
import { payrollMoneyDisplay as formatMoney } from "@/lib/money/payroll-display";
import { CurrencySelect } from "@/components/ui/currency-select";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/dashboard/error-state";
import { useDocumentTitle } from "@/lib/hooks/use-document-title";

export default function CRMAnalyticsPage() {
  const unitPresentation = useUnitPresentation();
  const t = useTranslations("CrmAnalytics");
  const stages = useTranslations("CrmPipeline");
  const [data, setData] = useState<CrmAnalytics | null>(null);
  const [currency, setCurrency] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  useDocumentTitle(t("documentTitle"));

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const orgId = localStorage.getItem("activeOrgId");
        if (!orgId) throw new Error("Missing organization");
        const response = await fetch(`/api/v1/crm/analytics${currency ? `?currency=${currency}` : ""}`, {
          headers: { "x-organization-id": orgId },
        });
        const body = await crmAnalyticsJson(response, currency);
        if (!cancelled) { setData(body); setError(null); }
      } catch {
        if (!cancelled) { setData(null); setError(t("loadFailed")); }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [currency, t]);

  if (loading) return <BrandLoader />;

  return (
    <ContentReveal>
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold">{t("title")}</h2>
          <p className="text-sm text-muted-foreground">
            {t("description")}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{t("currency")}</span>
          <CurrencySelect value={currency} onValueChange={value => { if (value !== currency) { setLoading(true); setCurrency(value); } }} compact />
          {currency && <Button variant="ghost" size="sm" onClick={() => { setLoading(true); setCurrency(""); }}>{t("allCurrencies")}</Button>}
        </div>
        {error && <ErrorState message={error} onRetry={() => window.location.reload()} />}
        {data && <>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title={t("pipelineValue")}
            value={formatMoney(data.totalPipelineValue, data.currency, unitPresentation)}
            icon={DollarSign}
          />
          <StatCard
            title={t("wonRevenue")}
            value={formatMoney(data.wonValue, data.currency, unitPresentation)}
            icon={TrendingUp}
            changeType="positive"
          />
          <StatCard
            title={t("conversionRate")}
            value={t("percent", { value: data.conversionRate })}
            icon={Target}
          />
          <StatCard
            title={t("averageDealSize")}
            value={formatMoney(data.avgDealValue, data.currency, unitPresentation)}
            icon={BarChart3}
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-lg border bg-card p-5">
            <h3 className="text-sm font-medium mb-4">{t("dealSummary")}</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{t("totalDeals")}</span>
                <span className="font-medium">{data.totalDeals}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{t("open")}</span>
                <span className="font-medium text-blue-600">{data.openDeals}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{t("won")}</span>
                <span className="font-medium text-emerald-600">{data.wonDeals}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{t("lost")}</span>
                <span className="font-medium text-red-600">{data.lostDeals}</span>
              </div>
            </div>
          </div>

          <div className="rounded-lg border bg-card p-5">
            <h3 className="text-sm font-medium mb-4">{t("stageDistribution")}</h3>
            <div className="space-y-2">
              {Object.entries(data.stageDistribution).map(([stage, info]) => (
                <div key={stage} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground capitalize">{Object.hasOwn(crmAnalyticsStageKeys, stage) ? stages(crmAnalyticsStageKeys[stage as keyof typeof crmAnalyticsStageKeys]) : stage}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">{t("dealCount", { count: info.count })}</span>
                    <span className="font-mono text-xs font-medium tabular-nums">{formatMoney(info.value, data.currency, unitPresentation)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        </>}
      </div>
    </ContentReveal>
  );
}
