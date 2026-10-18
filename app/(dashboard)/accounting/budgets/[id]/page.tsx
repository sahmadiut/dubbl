"use client";

import { useTranslations } from "next-intl";
import { budgetPeriodLabel } from "@/i18n/budget-presentation";

import { useState, useMemo } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { budgetMoney, budgetPercent, budgetAbs, budgetChartPoint } from "@/lib/money/budget-ui";
import { cn } from "@/lib/utils";
import { useDocumentTitle } from "@/lib/hooks/use-document-title";
import { useBudgetContext } from "./layout";
import type { BudgetLineData, PeriodComparison } from "./layout";
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

export default function BudgetOverviewPage() {
  const t = useTranslations("Budgets");
  const { budget, currencyCode, comparisons, totalBudgeted, totalActual } = useBudgetContext();

  useDocumentTitle(t("detailsTitle"));

  const formatMoney = (amount: bigint) => budgetMoney(amount, currencyCode);
  const grandTotal = budget.lines.reduce((s, l) => s + l.total, 0n);
  const totalVariance = totalBudgeted - totalActual;
  const overallPct = totalBudgeted !== 0n ? budgetPercent(totalActual, totalBudgeted) : 0;
  const over = totalActual > totalBudgeted;

  // Build chart data from period comparisons (aggregate across all accounts)
  const chartData = useMemo(() => {
    if (comparisons.length === 0) return [];

    // Collect all unique periods across all comparisons
    const periodMap = new Map<string, { label: string; sortOrder: number; budgeted: bigint; actual: bigint }>();

    for (const c of comparisons) {
      for (const p of c.periods || []) {
        const existing = periodMap.get(p.label);
        if (existing) {
          existing.budgeted += p.budgeted;
          existing.actual += p.actual;
        } else {
          periodMap.set(p.label, {
            label: p.label,
            sortOrder: p.sortOrder,
            budgeted: p.budgeted,
            actual: p.actual,
          });
        }
      }
    }

    return Array.from(periodMap.values())
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((p) => budgetChartPoint(p.label, p.budgeted, p.actual));
  }, [comparisons]);

  return (
    <div className="space-y-6">
      {/* Spending trend chart */}
      {chartData.length > 1 && (
        <div>
          <p className="text-sm font-medium mb-3">{t("spendingTrend")}</p>
          <div className="rounded-lg border p-4">
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <defs>
                  <linearGradient id="budgetedGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="actualGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="name" tickFormatter={(label: string) => budgetPeriodLabel(t, label)} tick={{ fontSize: 11 }} className="text-muted-foreground" />
                <YAxis tick={{ fontSize: 11 }} className="text-muted-foreground" tickFormatter={(v) => `${currencyCode} ${v >= 1000 ? t("chartThousands", { value: (v / 1000).toFixed(0) }) : v}`} />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                  labelFormatter={(label) => budgetPeriodLabel(t, String(label))}
                  formatter={(_value, _name, item) => [formatMoney(item.dataKey === "budgeted" ? item.payload.budgetedExact : item.payload.actualExact)]}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area type="monotone" dataKey="budgeted" name={t("budgeted")} stroke="#8b5cf6" fill="url(#budgetedGrad)" strokeWidth={2} />
                <Area type="monotone" dataKey="actual" name={t("actual")} stroke="#3b82f6" fill="url(#actualGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Per-account breakdown */}
      {comparisons.length > 0 ? (
        <div className="space-y-3">
          {comparisons.map((c) => {
            const pct = c.budgeted === 0n ? 0 : budgetPercent(c.actual, c.budgeted);
            const over = c.actual > c.budgeted;
            const budgetLine = budget.lines.find((l) => l.accountId === c.accountId);
            return (
              <ViewLineCard
                key={c.accountId}
                currencyCode={currencyCode}
                accountName={c.accountName}
                accountCode={c.accountCode}
                budgeted={c.budgeted}
                actual={c.actual}
                variance={c.variance}
                pct={pct}
                over={over}
                burnRate={c.burnRate}
                budgetLine={budgetLine}
                periodComparisons={c.periods}
              />
            );
          })}
        </div>
      ) : budget.lines.length > 0 ? (
        <div className="space-y-3">
          {budget.lines.map((line) => (
            <ViewLineCard
              key={line.id}
              currencyCode={currencyCode}
              accountName={line.account?.name || line.accountId}
              accountCode={line.account?.code || ""}
              budgeted={line.total}
              actual={0n}
              variance={line.total}
              pct={0}
              over={false}
              burnRate={0n}
              budgetLine={line}
              periodComparisons={[]}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed py-12 text-center">
          <p className="text-sm text-muted-foreground">{t("noConfiguredLines")}</p>
          <Button size="sm" variant="outline" className="mt-3" asChild>
            <a href={`/accounting/budgets/${budget.id}/settings`}>{t("addLines")}</a>
          </Button>
        </div>
      )}

      {/* Period breakdown table */}
      {comparisons.length > 0 && comparisons[0]?.periods?.length > 0 && (
        <>
          <div className="h-px bg-border" />
          <PeriodBreakdownTable comparisons={comparisons} currencyCode={currencyCode} />
        </>
      )}

      {/* Grand total */}
      {grandTotal !== 0n && (
        <div className="rounded-lg border bg-muted/30 px-4 py-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">{t("grandTotal")}</p>
            <p className="font-mono text-lg font-semibold tabular-nums">{formatMoney(grandTotal)}</p>
          </div>
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-4 text-muted-foreground">
              <span>{t.rich("spent", { amount: formatMoney(totalActual), strong: (chunks) => <span className="font-mono tabular-nums text-foreground">{chunks}</span> })}</span>
              <span className={cn(
                "font-mono tabular-nums",
                over ? "text-red-600" : "text-emerald-600"
              )}>
                {over ? t("overBy", { amount: formatMoney(budgetAbs(totalVariance)) }) : t("remaining", { amount: formatMoney(totalVariance) })}
              </span>
            </div>
            <span className={cn(
              "text-xs font-mono tabular-nums font-medium",
              over ? "text-red-600" : overallPct > 80 ? "text-amber-600" : "text-emerald-600"
            )}>
              {overallPct}%
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function ViewLineCard({
  currencyCode,
  accountName,
  accountCode,
  budgeted,
  actual,
  variance,
  pct,
  over,
  burnRate,
  budgetLine,
  periodComparisons,
}: {
  currencyCode: string;
  accountName: string;
  accountCode: string;
  budgeted: bigint;
  actual: bigint;
  variance: bigint;
  pct: number;
  over: boolean;
  burnRate: bigint;
  budgetLine?: BudgetLineData;
  periodComparisons: PeriodComparison[];
}) {
  const t = useTranslations("Budgets");
  const formatMoney = (amount: bigint) => budgetMoney(amount, currencyCode);
  const [expanded, setExpanded] = useState(false);

  const periods = periodComparisons.length > 0
    ? periodComparisons
    : (budgetLine?.periods || []).map((p) => ({
        id: p.id,
        label: p.label,
        startDate: p.startDate,
        endDate: p.endDate,
        budgeted: p.amount,
        actual: 0n,
        variance: p.amount,
        sortOrder: p.sortOrder,
      }));

  return (
    <div className="rounded-lg border px-4 py-3 space-y-2.5">
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium truncate">{accountName}</p>
            {accountCode && <span className="text-xs text-muted-foreground font-mono">{accountCode}</span>}
          </div>
        </div>
        <div className="text-right shrink-0 ml-4">
          <p className="text-sm font-mono font-semibold tabular-nums">
            {actual !== 0n ? (
              <>{formatMoney(actual)} <span className="text-muted-foreground font-normal">/ {formatMoney(budgeted)}</span></>
            ) : (
              formatMoney(budgeted)
            )}
          </p>
          {actual !== 0n && (
            <p className={cn(
              "text-xs font-mono tabular-nums",
              over ? "text-red-600" : "text-emerald-600"
            )}>
              {t(over ? "overBy" : "underBy", { amount: formatMoney(budgetAbs(variance)) })}
            </p>
          )}
        </div>
      </div>
      {actual !== 0n && (
        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              over ? "bg-red-500" : pct > 80 ? "bg-amber-500" : "bg-emerald-500"
            )}
            style={{ width: `${Math.max(0, Math.min(pct, 100))}%` }}
          />
        </div>
      )}
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <div className="flex items-center gap-3">
          {actual !== 0n && <span>{t("utilized", { percent: pct })}</span>}
          {actual !== 0n && <span className="font-mono tabular-nums">{t("remaining", { amount: formatMoney(budgeted - actual) })}</span>}
          {burnRate !== 0n && <span className="font-mono tabular-nums">{t("projected", { amount: formatMoney(burnRate) })}</span>}
          {actual === 0n && <span>{t("noSpending")}</span>}
        </div>
        {periods.length > 0 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 hover:text-foreground transition-colors"
          >
            {expanded ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
            {t("periods")}
          </button>
        )}
      </div>
      {expanded && periods.length > 0 && (
        <div className="space-y-1 pt-1">
          {periods.sort((a, b) => a.sortOrder - b.sortOrder).map((p) => {
            const pPct = p.budgeted === 0n ? 0 : budgetPercent(p.actual, p.budgeted);
            const pOver = p.actual > p.budgeted;
            return (
              <div key={p.id} className="flex items-center justify-between text-[11px] py-1 px-2 rounded hover:bg-muted/50">
                <span className="text-muted-foreground min-w-[80px]">{budgetPeriodLabel(t, p.label)}</span>
                <div className="flex items-center gap-3">
                  <span className="font-mono tabular-nums">{formatMoney(p.budgeted)}</span>
                  {p.actual !== 0n && (
                    <>
                      <span className="font-mono tabular-nums text-blue-600">{formatMoney(p.actual)}</span>
                      <span className={cn(
                        "font-mono tabular-nums",
                        pOver ? "text-red-600" : "text-emerald-600"
                      )}>
                        {pOver ? "+" : "-"}{formatMoney(budgetAbs(p.variance))}
                      </span>
                      <span className="text-muted-foreground w-8 text-right">{pPct}%</span>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PeriodBreakdownTable({ comparisons, currencyCode }: { currencyCode: string; comparisons: { periods: PeriodComparison[] }[] }) {
  const t = useTranslations("Budgets");
  const formatMoney = (amount: bigint) => budgetMoney(amount, currencyCode);
  // Aggregate periods across all accounts
  const periodMap = new Map<string, { label: string; sortOrder: number; budgeted: bigint; actual: bigint }>();

  for (const c of comparisons) {
    for (const p of c.periods || []) {
      const existing = periodMap.get(p.label);
      if (existing) {
        existing.budgeted += p.budgeted;
        existing.actual += p.actual;
      } else {
        periodMap.set(p.label, {
          label: p.label,
          sortOrder: p.sortOrder,
          budgeted: p.budgeted,
          actual: p.actual,
        });
      }
    }
  }

  const periods = Array.from(periodMap.values()).sort((a, b) => a.sortOrder - b.sortOrder);
  if (periods.length === 0) return null;

  const totBudgeted = periods.reduce((s, p) => s + p.budgeted, 0n);
  const totActual = periods.reduce((s, p) => s + p.actual, 0n);
  const totVariance = totBudgeted - totActual;

  return (
    <div>
      <p className="text-sm font-medium mb-3">{t("periodBreakdown")}</p>
      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/30">
              <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">{t("period")}</th>
              <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground">{t("budgeted")}</th>
              <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground">{t("actual")}</th>
              <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground">{t("variance")}</th>
            </tr>
          </thead>
          <tbody>
            {periods.map((p) => {
              const variance = p.budgeted - p.actual;
              return (
                <tr key={p.label} className="border-b last:border-b-0">
                  <td className="px-4 py-2 text-sm">{budgetPeriodLabel(t, p.label)}</td>
                  <td className="px-4 py-2 text-right font-mono tabular-nums text-sm">{formatMoney(p.budgeted)}</td>
                  <td className="px-4 py-2 text-right font-mono tabular-nums text-sm text-blue-600">{formatMoney(p.actual)}</td>
                  <td className={cn(
                    "px-4 py-2 text-right font-mono tabular-nums text-sm",
                    variance >= 0 ? "text-emerald-600" : "text-red-600"
                  )}>
                    {variance >= 0 ? "" : "-"}{formatMoney(budgetAbs(variance))}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t bg-muted/30">
              <td className="px-4 py-2 text-sm font-medium">{t("total")}</td>
              <td className="px-4 py-2 text-right font-mono tabular-nums text-sm font-semibold">{formatMoney(totBudgeted)}</td>
              <td className="px-4 py-2 text-right font-mono tabular-nums text-sm font-semibold text-blue-600">{formatMoney(totActual)}</td>
              <td className={cn(
                "px-4 py-2 text-right font-mono tabular-nums text-sm font-semibold",
                totVariance >= 0 ? "text-emerald-600" : "text-red-600"
              )}>
                {totVariance >= 0 ? "" : "-"}{formatMoney(budgetAbs(totVariance))}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
