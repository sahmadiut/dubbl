"use client";

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

interface Analytics {
  currency: string;
  totalDeals: number;
  openDeals: number;
  wonDeals: number;
  lostDeals: number;
  totalPipelineValue: number;
  wonValue: number;
  conversionRate: number;
  avgDealValue: number;
  stageDistribution: Record<string, { count: number; value: number }>;
}

export default function CRMAnalyticsPage() {
  const [data, setData] = useState<Analytics | null>(null);
  const [currency, setCurrency] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  useDocumentTitle("CRM · Analytics");

  useEffect(() => {
    const orgId = localStorage.getItem("activeOrgId") || "";
    let cancelled = false;
    fetch(`/api/v1/crm/analytics${currency ? `?currency=${currency}` : ""}`, {
      headers: { "x-organization-id": orgId },
    })
      .then(async r => { const body = await r.json(); if (!r.ok) throw new Error(body.error || "Failed to load analytics"); return body; })
      .then(body => { if (!cancelled) { setData(body); setError(null); } })
      .catch(err => { if (!cancelled) { setData(null); setError(err.message); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [currency]);

  if (loading) return <BrandLoader />;

  return (
    <ContentReveal>
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold">Pipeline Analytics</h2>
          <p className="text-sm text-muted-foreground">
            Overview of your sales pipeline performance.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">Currency</span>
          <CurrencySelect value={currency} onValueChange={value => { if (value !== currency) { setLoading(true); setCurrency(value); } }} compact />
          {currency && <Button variant="ghost" size="sm" onClick={() => { setLoading(true); setCurrency(""); }}>All currencies</Button>}
        </div>
        {error && <ErrorState message={error} onRetry={() => window.location.reload()} />}
        {data && <>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Pipeline Value"
            value={formatMoney(data.totalPipelineValue, data.currency)}
            icon={DollarSign}
          />
          <StatCard
            title="Won Revenue"
            value={formatMoney(data.wonValue, data.currency)}
            icon={TrendingUp}
            changeType="positive"
          />
          <StatCard
            title="Conversion Rate"
            value={`${data.conversionRate}%`}
            icon={Target}
          />
          <StatCard
            title="Avg Deal Size"
            value={formatMoney(data.avgDealValue, data.currency)}
            icon={BarChart3}
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-lg border bg-card p-5">
            <h3 className="text-sm font-medium mb-4">Deal Summary</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Total Deals</span>
                <span className="font-medium">{data.totalDeals}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Open</span>
                <span className="font-medium text-blue-600">{data.openDeals}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Won</span>
                <span className="font-medium text-emerald-600">{data.wonDeals}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Lost</span>
                <span className="font-medium text-red-600">{data.lostDeals}</span>
              </div>
            </div>
          </div>

          <div className="rounded-lg border bg-card p-5">
            <h3 className="text-sm font-medium mb-4">Stage Distribution</h3>
            <div className="space-y-2">
              {Object.entries(data.stageDistribution || {}).map(([stage, info]) => (
                <div key={stage} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground capitalize">{stage.replace("_", " ")}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">{info.count} deals</span>
                    <span className="font-mono text-xs font-medium tabular-nums">{formatMoney(info.value, data.currency)}</span>
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
