"use client";

import { BidiText, IdentifierText } from "@/components/ui/bidi-text";

import { currencyLabel } from "@/i18n/currency-labels";
import { usePresentation } from "@/i18n/provider";
import { localeDirection } from "@/i18n/locale";
import { expenseAnalyticsUi, analyticalReportJson } from "@/lib/money/analytical-report-ui";
import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { BackToReports } from "../_components";
import { PieChart, TrendingDown } from "lucide-react";
import { BrandLoader } from "@/components/dashboard/brand-loader";
import { ContentReveal } from "@/components/ui/content-reveal";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { DateRangeFilter } from "@/components/dashboard/date-range-filter";
import { analyticalMoney as statementMoneyText } from "@/lib/money/analytical-report-ui";
import { money, toMajorDecimal } from "@/lib/money/exact";
import { cn } from "@/lib/utils";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type Category = ReturnType<typeof expenseAnalyticsUi>["categories"][number];

type MonthlyPoint = ReturnType<typeof expenseAnalyticsUi>["monthlyTrend"][number];

const CATEGORY_COLORS = [
  "bg-red-500",
  "bg-orange-500",
  "bg-amber-500",
  "bg-yellow-500",
  "bg-lime-500",
  "bg-emerald-500",
  "bg-teal-500",
  "bg-cyan-500",
  "bg-blue-500",
  "bg-violet-500",
];

export default function ExpenseAnalyticsPage() {
  const presentation = usePresentation();
  const t = useTranslations("AnalyticalReports");
  const now = new Date();
  const [initialLoad, setInitialLoad] = useState(true);
  const [loading, setLoading] = useState(true);
  const [currencyCode, setCurrencyCode] = useState("USD");
  const [error, setError] = useState(false);
  const [startDate, setStartDate] = useState(`${now.getFullYear()}-01-01`);
  const [endDate, setEndDate] = useState(now.toISOString().slice(0, 10));
  const [categories, setCategories] = useState<Category[]>([]);
  const [monthlyTrend, setMonthlyTrend] = useState<MonthlyPoint[]>([]);
  const [totalExpenses, setTotalExpenses] = useState(0n);
  const [monthlyAverage, setMonthlyAverage] = useState(0n);

  useEffect(() => {
    const orgId = localStorage.getItem("activeOrgId");
    if (!orgId) return;
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams({ startDate, endDate });
    fetch(`/api/v1/reports/expense-analytics?${params}`, {
      headers: { "x-organization-id": orgId },
    })
      .then((r) => analyticalReportJson(r, expenseAnalyticsUi))
      .then((data) => {
        if (cancelled) return;
        setCurrencyCode(data.currencyCode);
        setError(false);
        setCategories(data.categories || []);
        setMonthlyTrend(data.monthlyTrend || []);
        setTotalExpenses(data.totalExpenses);
        setMonthlyAverage(data.monthlyAverage);
      })
      .catch(() => {
        if (!cancelled) { setCategories([]); setMonthlyTrend([]); setTotalExpenses(0n); setMonthlyAverage(0n); setError(true); }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
          setInitialLoad(false);
        }
      });
    return () => { cancelled = true; };
  }, [startDate, endDate]);

  const chartData = monthlyTrend.map((m) => ({
    name: m.month,
    expenses: Number(toMajorDecimal(money(BigInt(m.total), currencyCode))),
    minorUnits: m.total,
  }));

  if (initialLoad) return <BrandLoader />;

  return (
    <ContentReveal className="space-y-6">
      <BackToReports />

      <PageHeader
        title={t("expenseTitle")}
        description={t("expenseDescription")}
      />

      <DateRangeFilter
        startDate={startDate}
        endDate={endDate}
        onDateChange={(s, e) => { setStartDate(s); setEndDate(e); }}
      />

      {loading ? (
        <BrandLoader className="h-48" />
      ) : error ? (
        <p role="alert" className="text-sm text-red-600">{t("loadFailed")}</p>
      ) : (
        <ContentReveal>
          <div className="grid gap-4 sm:grid-cols-2">
            <StatCard
              title={t("totalSpent")}
              value={statementMoneyText(totalExpenses, currencyCode, presentation)}
              icon={TrendingDown}
              changeType="negative"
            />
            <StatCard
              title={t("monthlyAverage")}
              value={statementMoneyText(monthlyAverage, currencyCode, presentation)}
              icon={PieChart}
              changeType="neutral"
            />
          </div>

          {/* Monthly Trend */}
          {chartData.length > 1 && (
            <div className="mt-4">
              <p className="text-sm font-medium mb-3">{t("monthlySpending")}</p>
              <div className="rounded-lg border p-4">
                <div dir="ltr" className="min-w-0 [&_text]:[unicode-bidi:plaintext] [&_.recharts-tooltip-wrapper]:max-w-full [&_.recharts-default-tooltip]:whitespace-normal [&_.recharts-default-tooltip]:[overflow-wrap:anywhere]">
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                    <defs>
                      <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} className="text-muted-foreground" />
                    <YAxis tick={{ fontSize: 11 }} className="text-muted-foreground" tickFormatter={(v) => `${currencyLabel(currencyCode, presentation.locale)} ${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`} />
                    <Tooltip
                      contentStyle={{ fontSize: 12, borderRadius: 8, direction: localeDirection(presentation.locale) }}
                      formatter={(_value, _name, item) => [statementMoneyText(item.payload.minorUnits, currencyCode, presentation)]}
                    />
                    <Area type="monotone" dataKey="expenses" name={t("expenses")} stroke="#ef4444" fill="url(#expGrad)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {/* Category Breakdown */}
          {categories.length > 0 ? (
            <div className="mt-4">
              <p className="text-sm font-medium mb-3">{t("byCategory")}</p>

              {/* Stacked bar visualization */}
              <div className="h-3 rounded-full overflow-hidden flex mb-4">
                {categories.slice(0, 10).map((c, i) => (
                  <div
                    key={c.accountId}
                    className={cn("h-full", CATEGORY_COLORS[i % CATEGORY_COLORS.length])}
                    style={{ width: `${c.percentage}%` }}
                    title={`${c.accountName}: ${c.percentage}%`}
                  />
                ))}
              </div>

              <div className="space-y-2">
                {categories.map((c, i) => (
                  <div key={c.accountId} className="flex flex-wrap items-center justify-between rounded-lg border px-4 py-2.5">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={cn("size-2.5 rounded-full shrink-0", CATEGORY_COLORS[i % CATEGORY_COLORS.length])} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium min-w-0 whitespace-normal [overflow-wrap:anywhere]"><BidiText>{c.accountName}</BidiText></p>
                        <p className="text-xs text-muted-foreground">
                          {t.rich("categoryTransactions", { code: c.accountCode, count: c.transactions, em: (chunks) => <IdentifierText>{chunks}</IdentifierText> })}
                        </p>
                      </div>
                    </div>
                    <div className="text-end shrink-0 ms-4">
                      <p className="text-sm font-mono font-semibold tabular-nums"><IdentifierText>{statementMoneyText(c.total, currencyCode, presentation)}</IdentifierText></p>
                      <p className="text-xs text-muted-foreground font-mono tabular-nums"><IdentifierText>{c.percentage}%</IdentifierText></p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed py-12 text-center mt-4">
              <p className="text-sm text-muted-foreground">{t("noExpenseData")}</p>
            </div>
          )}
        </ContentReveal>
      )}
    </ContentReveal>
  );
}
