"use client";

import { BidiText, IdentifierText } from "@/components/ui/bidi-text";

import { currencyLabel } from "@/i18n/currency-labels";
import { usePresentation } from "@/i18n/provider";
import { localeDirection } from "@/i18n/locale";
import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { BackToReports } from "../_components";
import { PageHeader } from "@/components/dashboard/page-header";
import { BrandLoader } from "@/components/dashboard/brand-loader";
import { ErrorState } from "@/components/dashboard/error-state";
import { financialStatementJson, pnlComparisonUi, statementChartPoint, statementUiMoney, type PnlComparisonUi } from "@/lib/money/financial-statement-ui";
import { ContentReveal } from "@/components/ui/content-reveal";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { cn } from "@/lib/utils";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

type PeriodData = PnlComparisonUi["periods"][number];

export default function PnlComparisonPage() {
  const presentation = usePresentation();
  const t = useTranslations("AnalyticalReports");
  const [initialLoad, setInitialLoad] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [compareType, setCompareType] = useState("monthly");
  const [periodsCount, setPeriodsCount] = useState(6);
  const [currencyCode, setCurrencyCode] = useState("USD");
  const formatMoney = (value: bigint) => statementUiMoney(value, currencyCode, presentation);
  const [periods, setPeriods] = useState<PeriodData[]>([]);

  useEffect(() => {
    const orgId = localStorage.getItem("activeOrgId");
    if (!orgId) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(false);
    const params = new URLSearchParams({
      compare: compareType,
      periods: String(periodsCount),
    });
    fetch(`/api/v1/reports/pnl-comparison?${params}`, {
      headers: { "x-organization-id": orgId },
    })
      .then((r) => financialStatementJson(r, pnlComparisonUi))
      .then((data) => {
        if (cancelled) return;
        setCurrencyCode(data.currencyCode);
        setPeriods(data.periods);
      })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
          setInitialLoad(false);
        }
      });
    return () => { cancelled = true; };
  }, [compareType, periodsCount]);

  const chartData = periods.map(period => statementChartPoint(period, currencyCode));

  if (initialLoad) return <BrandLoader />;
  if (error) return <ErrorState message={t("loadFailed")} onRetry={() => window.location.reload()} />;

  return (
    <ContentReveal className="space-y-6">
      <BackToReports />

      <PageHeader
        title={t("comparisonTitle")}
        description={t("comparisonDescription")}
      />

      <div className="flex flex-wrap items-center gap-3">
        <Select value={compareType} onValueChange={setCompareType}>
          <SelectTrigger aria-label={t("comparisonTypeLabel")} className="w-[140px] data-[size=default]:h-auto min-h-9 max-w-full whitespace-normal [&_[data-slot=select-value]]:line-clamp-none [&_[data-slot=select-value]]:whitespace-normal [&_[data-slot=select-value]]:text-start">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="monthly">{t("monthly")}</SelectItem>
            <SelectItem value="quarterly">{t("quarterly")}</SelectItem>
            <SelectItem value="yearly">{t("yearly")}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={String(periodsCount)} onValueChange={(v) => setPeriodsCount(Number(v))}>
          <SelectTrigger aria-label={t("comparisonPeriodsLabel")} className="w-[130px] data-[size=default]:h-auto min-h-9 max-w-full whitespace-normal [&_[data-slot=select-value]]:line-clamp-none [&_[data-slot=select-value]]:whitespace-normal [&_[data-slot=select-value]]:text-start">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[3, 4, 6, 8, 12].map((n) => (
              <SelectItem key={n} value={String(n)}>{t("periodCount", { count: n })}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <BrandLoader className="h-48" />
      ) : periods.length === 0 ? (
        <ContentReveal>
          <div className="rounded-xl border border-dashed py-12 text-center">
            <p className="text-sm text-muted-foreground">{t("noComparisonData")}</p>
          </div>
        </ContentReveal>
      ) : (
        <ContentReveal>
          {/* Trend Chart */}
          <div className="space-y-6">
            <div className="rounded-lg border p-4">
              <div dir="ltr" className="min-w-0 [&_text]:[unicode-bidi:plaintext] [&_.recharts-tooltip-wrapper]:max-w-full [&_.recharts-default-tooltip]:whitespace-normal [&_.recharts-default-tooltip]:[overflow-wrap:anywhere]">
                <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                  <defs>
                    <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="expensesGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} className="text-muted-foreground" />
                  <YAxis tick={{ fontSize: 11 }} className="text-muted-foreground" tickFormatter={(v) => `${currencyLabel(currencyCode, presentation.locale)} ${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`} />
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8, direction: localeDirection(presentation.locale) }}
                    formatter={(_value, name, item) => [statementUiMoney(item.payload[item.dataKey === "revenue" ? "revenueExact" : "expensesExact"], currencyCode, presentation), name]}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Area type="monotone" dataKey="revenue" name={t("revenue")} stroke="#10b981" fill="url(#revenueGrad)" strokeWidth={2} />
                  <Area type="monotone" dataKey="expenses" name={t("expenses")} stroke="#ef4444" fill="url(#expensesGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
                </div>
            </div>

            {/* Comparison Table */}
            <div className="rounded-lg border overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-start px-4 py-2.5 text-xs font-medium text-muted-foreground sticky start-0 bg-muted/30">{t("metric")}</th>
                    {periods.map((p) => (
                      <th key={p.label} className="text-end px-4 py-2.5 text-xs font-medium text-muted-foreground min-w-[120px]"><BidiText>
                        {p.label}
                      </BidiText></th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {/* Revenue */}
                  <tr className="border-b">
                    <td className="px-4 py-2.5 font-medium sticky start-0 bg-background">{t("revenue")}</td>
                    {periods.map((p) => (
                      <td key={p.label} className="px-4 py-2.5 text-end font-mono tabular-nums"><IdentifierText>
                        {formatMoney(p.totalRevenue)}
                      </IdentifierText></td>
                    ))}
                  </tr>
                  <tr className="border-b bg-muted/20">
                    <td className="px-4 py-1.5 text-xs text-muted-foreground sticky start-0 bg-muted/20">{t("change")}</td>
                    {periods.map((p, i) => (
                      <td key={p.label} className="px-4 py-1.5 text-end">
                        {i === 0 ? (
                          <span className="text-xs text-muted-foreground">-</span>
                        ) : (
                          <ChangeCell currencyCode={currencyCode} amount={p.revenueChange} pct={p.revenueChangePct} />
                        )}
                      </td>
                    ))}
                  </tr>
                  {/* Expenses */}
                  <tr className="border-b">
                    <td className="px-4 py-2.5 font-medium sticky start-0 bg-background">{t("expenses")}</td>
                    {periods.map((p) => (
                      <td key={p.label} className="px-4 py-2.5 text-end font-mono tabular-nums"><IdentifierText>
                        {formatMoney(p.totalExpenses)}
                      </IdentifierText></td>
                    ))}
                  </tr>
                  <tr className="border-b bg-muted/20">
                    <td className="px-4 py-1.5 text-xs text-muted-foreground sticky start-0 bg-muted/20">{t("change")}</td>
                    {periods.map((p, i) => (
                      <td key={p.label} className="px-4 py-1.5 text-end">
                        {i === 0 ? (
                          <span className="text-xs text-muted-foreground">-</span>
                        ) : (
                          <ChangeCell currencyCode={currencyCode} amount={p.expensesChange} pct={p.expensesChangePct} inverted />
                        )}
                      </td>
                    ))}
                  </tr>
                  {/* Net Income */}
                  <tr className="border-t-2">
                    <td className="px-4 py-2.5 font-semibold sticky start-0 bg-background">{t("netIncome")}</td>
                    {periods.map((p) => (
                      <td key={p.label} className={cn(
                        "px-4 py-2.5 text-end font-mono tabular-nums font-semibold",
                        p.netIncome >= 0 ? "text-emerald-600" : "text-red-600"
                      )}><IdentifierText>
                        {formatMoney(p.netIncome)}
                      </IdentifierText></td>
                    ))}
                  </tr>
                  <tr className="bg-muted/20">
                    <td className="px-4 py-1.5 text-xs text-muted-foreground sticky start-0 bg-muted/20">{t("change")}</td>
                    {periods.map((p, i) => (
                      <td key={p.label} className="px-4 py-1.5 text-end">
                        {i === 0 ? (
                          <span className="text-xs text-muted-foreground">-</span>
                        ) : (
                          <ChangeCell currencyCode={currencyCode} amount={p.netIncomeChange} pct={p.netIncomeChangePct} />
                        )}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </ContentReveal>
      )}
    </ContentReveal>
  );
}

function ChangeCell({ amount, pct, inverted, currencyCode }: { amount: bigint; pct: number; inverted?: boolean; currencyCode: string }) {
  const presentation = usePresentation();
  const positive = inverted ? amount < 0 : amount > 0;
  const color = amount === 0n ? "text-muted-foreground" : positive ? "text-emerald-600" : "text-red-600";

  return (
    <div className={cn("text-xs font-mono tabular-nums", color)}>
      <IdentifierText>{amount > 0 ? "+" : ""}{statementUiMoney(amount, currencyCode, presentation)}</IdentifierText>
      <IdentifierText className="ms-1 text-[10px]">({pct > 0 ? "+" : ""}{pct}%)</IdentifierText>
    </div>
  );
}
