"use client";

import { IdentifierText } from "@/components/ui/bidi-text";

import { currencyLabel } from "@/i18n/currency-labels";
import { usePresentation } from "@/i18n/provider";
import { localeDirection } from "@/i18n/locale";
import { cashForecastUi, analyticalReportJson } from "@/lib/money/analytical-report-ui";
import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { BackToReports } from "../_components";
import { TrendingUp, TrendingDown, DollarSign } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { BrandLoader } from "@/components/dashboard/brand-loader";
import { ContentReveal } from "@/components/ui/content-reveal";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { analyticalMoney as statementMoneyText } from "@/lib/money/analytical-report-ui";
import { money, toMajorDecimal } from "@/lib/money/exact";
import { CurrencySelect } from "@/components/ui/currency-select";
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
  ReferenceLine,
} from "recharts";

type ForecastWeek = ReturnType<typeof cashForecastUi>["weeks"][number];

export default function CashFlowForecastPage() {
  const presentation = usePresentation();
  const t = useTranslations("ForecastCalendarReports");
  const [initialLoad, setInitialLoad] = useState(true);
  const [loading, setLoading] = useState(true);
  const [currencyCode, setCurrencyCode] = useState("USD");
  const [currencyFilter, setCurrencyFilter] = useState("");
  const [error, setError] = useState(false);
  const [weeksAhead, setWeeksAhead] = useState(12);
  const [weeks, setWeeks] = useState<ForecastWeek[]>([]);
  const [totalInflows, setTotalInflows] = useState(0n);
  const [totalOutflows, setTotalOutflows] = useState(0n);
  const [netForecast, setNetForecast] = useState(0n);

  useEffect(() => {
    const orgId = localStorage.getItem("activeOrgId");
    if (!orgId) return;
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams({ weeks: String(weeksAhead) });
    if (currencyFilter) params.set("currencyCode", currencyFilter);
    fetch(`/api/v1/reports/cash-flow-forecast?${params}`, {
      headers: { "x-organization-id": orgId },
    })
      .then((r) => analyticalReportJson(r, cashForecastUi))
      .then((data) => {
        if (cancelled) return;
        setError(false);
        setCurrencyCode(data.currencyCode);
        setWeeks(data.weeks || []);
        setTotalInflows(data.totalInflows);
        setTotalOutflows(data.totalOutflows);
        setNetForecast(data.netForecast);
      })
      .catch(() => {
        if (!cancelled) { setWeeks([]); setTotalInflows(0n); setTotalOutflows(0n); setNetForecast(0n); setError(true); }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
          setInitialLoad(false);
        }
      });
    return () => { cancelled = true; };
  }, [weeksAhead, currencyFilter]);

  const chartData = weeks.map((w) => ({
    name: w.weekOf,
    inflows: Number(toMajorDecimal(money(BigInt(w.inflows), currencyCode))),
    outflows: Number(toMajorDecimal(money(BigInt(w.outflows), currencyCode))),
    minor: w,
    cumulative: Number(toMajorDecimal(money(BigInt(w.cumulativeNet), currencyCode))),
  }));

  if (initialLoad) return <BrandLoader />;

  return (
    <ContentReveal className="space-y-6">
      <BackToReports />

      <PageHeader
        title={t("forecastTitle")}
        description={t("forecastDescription")}
      />

      <div className="flex flex-wrap items-center gap-3">
        <Select value={String(weeksAhead)} onValueChange={(v) => setWeeksAhead(Number(v))}>
          <SelectTrigger aria-label={t("forecastPeriodLabel")} className="w-[140px] data-[size=default]:h-auto min-h-9 max-w-full whitespace-normal [&_[data-slot=select-value]]:line-clamp-none [&_[data-slot=select-value]]:whitespace-normal [&_[data-slot=select-value]]:text-start">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[4, 8, 12, 26, 52].map((count) => <SelectItem key={count} value={String(count)}>{t("weeks", { count })}</SelectItem>)}
          </SelectContent>
        </Select>
        <CurrencySelect value={currencyFilter} onValueChange={setCurrencyFilter} className="w-[220px]" />
        {currencyFilter && <button type="button" className="text-sm underline" onClick={() => setCurrencyFilter("")}>{t("clearFilter")}</button>}
      </div>
      <p className="text-sm text-muted-foreground">{t("estimateHelp")}</p>

      {error && <p role="alert" className="text-sm text-destructive">{t("forecastLoadError")}</p>}

      {!error && <>
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          title={t("expectedIn")}
          value={statementMoneyText(totalInflows, currencyCode, presentation)}
          icon={TrendingUp}
          changeType="positive"
        />
        <StatCard
          title={t("expectedOut")}
          value={statementMoneyText(totalOutflows, currencyCode, presentation)}
          icon={TrendingDown}
          changeType="negative"
        />
        <StatCard
          title={t("expectedChange")}
          value={statementMoneyText(netForecast, currencyCode, presentation)}
          icon={DollarSign}
          changeType={netForecast >= 0 ? "positive" : "negative"}
        />
      </div>

      {loading ? (
        <BrandLoader className="h-48" />
      ) : weeks.length === 0 ? (
        <ContentReveal>
          <div className="rounded-xl border border-dashed py-12 text-center">
            <p className="text-sm text-muted-foreground">{t("noForecast")}</p>
          </div>
        </ContentReveal>
      ) : (
        <ContentReveal>
          {/* Cumulative Net Chart */}
          <div className="space-y-6">
            <div>
              <p className="text-sm font-medium mb-3">{t("cumulativeCashFlow")}</p>
              <div className="rounded-lg border p-4">
                <div dir="ltr" className="min-w-0 [&_text]:[unicode-bidi:plaintext] [&_.recharts-tooltip-wrapper]:max-w-full [&_.recharts-default-tooltip]:whitespace-normal [&_.recharts-default-tooltip]:[overflow-wrap:anywhere]">
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                    <defs>
                      <linearGradient id="cumGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} className="text-muted-foreground" />
                    <YAxis tick={{ fontSize: 11 }} className="text-muted-foreground" tickFormatter={(v) => `${currencyLabel(currencyCode, presentation.locale)} ${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`} />
                    <Tooltip
                      contentStyle={{ fontSize: 12, borderRadius: 8, direction: localeDirection(presentation.locale) }}
                      formatter={(_value, name, item) => {
                        const minor = item.payload?.minor as ForecastWeek | undefined;
                        const value = item.dataKey === "inflows" ? minor?.inflows : item.dataKey === "outflows" ? minor?.outflows : minor?.cumulativeNet;
                        return [value === undefined ? "" : statementMoneyText(value, currencyCode, presentation), name];
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="3 3" />
                    <Area type="monotone" dataKey="inflows" name={t("inflows")} stroke="#10b981" fill="none" strokeWidth={1.5} />
                    <Area type="monotone" dataKey="outflows" name={t("outflows")} stroke="#ef4444" fill="none" strokeWidth={1.5} />
                    <Area type="monotone" dataKey="cumulative" name={t("cumulativeNet")} stroke="#3b82f6" fill="url(#cumGrad)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Weekly Breakdown Table */}
            <div>
              <p className="text-sm font-medium mb-3">{t("weeklyBreakdown")}</p>
              <div className="rounded-lg border overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-start px-4 py-2.5 text-xs font-medium text-muted-foreground">{t("weekOf")}</th>
                      <th className="text-end px-4 py-2.5 text-xs font-medium text-muted-foreground">{t("inflows")}</th>
                      <th className="text-end px-4 py-2.5 text-xs font-medium text-muted-foreground">{t("outflows")}</th>
                      <th className="text-end px-4 py-2.5 text-xs font-medium text-muted-foreground">{t("net")}</th>
                      <th className="text-end px-4 py-2.5 text-xs font-medium text-muted-foreground">{t("cumulative")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {weeks.map((w) => (
                      <tr key={w.weekOf} className="border-b last:border-b-0">
                        <td className="px-4 py-2"><IdentifierText>{w.weekOf}</IdentifierText></td>
                        <td className="px-4 py-2 text-end font-mono tabular-nums text-emerald-600"><IdentifierText>
                          {w.inflows > 0 ? statementMoneyText(w.inflows, currencyCode, presentation) : "-"}
                        </IdentifierText></td>
                        <td className="px-4 py-2 text-end font-mono tabular-nums text-red-600"><IdentifierText>
                          {w.outflows > 0 ? statementMoneyText(w.outflows, currencyCode, presentation) : "-"}
                        </IdentifierText></td>
                        <td className={cn(
                          "px-4 py-2 text-end font-mono tabular-nums font-medium",
                          w.net >= 0 ? "text-emerald-600" : "text-red-600"
                        )}><IdentifierText>
                          {statementMoneyText(w.net, currencyCode, presentation)}
                        </IdentifierText></td>
                        <td className={cn(
                          "px-4 py-2 text-end font-mono tabular-nums",
                          w.cumulativeNet >= 0 ? "text-blue-600" : "text-red-600"
                        )}><IdentifierText>
                          {statementMoneyText(w.cumulativeNet, currencyCode, presentation)}
                        </IdentifierText></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </ContentReveal>
      )}
      </>}
    </ContentReveal>
  );
}
