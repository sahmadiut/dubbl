"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { usePresentation } from "@/i18n/provider";
import { currencyPartsText } from "@/i18n/currency-labels";
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
import { displayMoney, displayJson, cashForecastUi, forecastChartPoint, type CashForecastUi } from "@/lib/money/contact-dashboard-ui";
import { CurrencySelect } from "@/components/ui/currency-select";
import { cn } from "@/lib/utils";

const periods = [
  { days: 30, weeks: 4 },
  { days: 60, weeks: 9 },
  { days: 90, weeks: 13 },
];

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { dataKey: "inflows" | "outflows" | "balance"; payload: ReturnType<typeof forecastChartPoint> }[]; label?: string }) {
  const t = useTranslations("DashboardOverview");
  const presentation = usePresentation();
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-card p-3 shadow-md">
      <p className="text-xs font-medium mb-1.5">{label}</p>
      {payload.map((entry) => (
        <div
          key={entry.dataKey}
          className="flex items-center justify-between gap-4 text-xs"
        >
          <span className="text-muted-foreground capitalize">
            {t(entry.dataKey)}
          </span>
          <span
            className={cn(
              "font-mono tabular-nums font-medium",
              entry.dataKey === "inflows"
                ? "text-emerald-600"
                : entry.dataKey === "outflows"
                ? "text-red-600"
                : ""
            )}
          >
            {displayMoney(entry.payload[`${entry.dataKey}Exact`], entry.payload.currencyCode, presentation)}
          </span>
        </div>
      ))}
    </div>
  );
}

export function CashFlowWidget() {
  const t = useTranslations("DashboardOverview");
  const presentation = usePresentation();
  const [currencyCode, setCurrencyCode] = useState("");
  const [weeks, setWeeks] = useState(4);
  const [forecast, setForecast] = useState<CashForecastUi | null>(null);
  const [error, setError] = useState<"forecastError" | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const id = localStorage.getItem("activeOrgId");
    if (!id) return;
    let active = true;
    const controller = new AbortController();
    setLoading(true);
    setForecast(null);
    setError(null);
    (async () => {
      try {
        const r = await fetch(`/api/v1/reports/cash-flow-forecast?weeks=${weeks}${currencyCode ? `&currencyCode=${currencyCode}` : ""}`, {
          headers: { "x-organization-id": id },
          signal: controller.signal,
        });
        const data = await displayJson(r, cashForecastUi);
        if (active) setForecast(data);
      } catch {
        if (active) { setForecast(null); setError("forecastError"); }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; controller.abort(); };
  }, [weeks, currencyCode]);

  const chartData = forecast?.weeks.map(week => forecastChartPoint(week, forecast.currencyCode)) ?? [];

  return (
    <div className="rounded-lg border bg-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground">
          {t("forecastTitle")}
        </h3>
        <div className="flex gap-1 rounded-lg bg-muted p-0.5">
          {periods.map((p) => (
            <button
              key={p.weeks}
              onClick={() => setWeeks(p.weeks)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                weeks === p.weeks
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t("periodDays", { count: p.days })}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-4"><CurrencySelect value={currencyCode} onValueChange={setCurrencyCode} compact /></div>
      {loading ? (
        <div className="space-y-3">
          <div className="h-[220px] rounded-md bg-muted animate-pulse" />
          <div className="grid grid-cols-3 gap-4 border-t pt-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex flex-col items-center gap-1.5">
                <div className="h-3 w-16 rounded bg-muted animate-pulse" />
                <div className="h-4 w-20 rounded bg-muted animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      ) : forecast ? (
        <>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="inflowGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor="#10b981"
                      stopOpacity={0.3}
                    />
                    <stop
                      offset="95%"
                      stopColor="#10b981"
                      stopOpacity={0}
                    />
                  </linearGradient>
                  <linearGradient
                    id="outflowGrad"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="5%"
                      stopColor="#ef4444"
                      stopOpacity={0.3}
                    />
                    <stop
                      offset="95%"
                      stopColor="#ef4444"
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11 }}
                  className="text-muted-foreground"
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  className="text-muted-foreground"
                  tickFormatter={(v) =>
                    currencyPartsText(new Intl.NumberFormat(presentation.locale, { numberingSystem: presentation.numerals, style: "currency", currency: forecast.currencyCode, notation: "compact" }).formatToParts(v), forecast.currencyCode, presentation.locale)
                  }
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  iconSize={8}
                  wrapperStyle={{ fontSize: "11px" }}
                />
                <Area
                  type="monotone"
                  dataKey="inflows"
                  name={t("inflows")}
                  stroke="#10b981"
                  fill="url(#inflowGrad)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="outflows"
                  name={t("outflows")}
                  stroke="#ef4444"
                  fill="url(#outflowGrad)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="balance"
                  name={t("balance")}
                  stroke="#3b82f6"
                  fill="none"
                  strokeWidth={2}
                  strokeDasharray="4 2"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-4 border-t pt-4">
            <div className="text-center">
              <p className="text-xs text-muted-foreground">{t("expectedIn")}</p>
              <p className="text-sm font-bold font-mono tabular-nums text-emerald-600">
                {displayMoney(forecast.totalInflows, forecast.currencyCode, presentation)}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground">{t("expectedOut")}</p>
              <p className="text-sm font-bold font-mono tabular-nums text-red-600">
                {displayMoney(forecast.totalOutflows, forecast.currencyCode, presentation)}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground">{t("netPosition")}</p>
              <p
                className={cn(
                  "text-sm font-bold font-mono tabular-nums",
                  forecast.netForecast >= 0
                    ? "text-emerald-600"
                    : "text-red-600"
                )}
              >
                {displayMoney(forecast.netForecast, forecast.currencyCode, presentation)}
              </p>
            </div>
          </div>
        </>
      ) : error ? <p role="alert" className="text-sm text-red-600">{t(error)}</p> : null}
    </div>
  );
}
