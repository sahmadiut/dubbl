"use client";

import { useTranslations } from "next-intl";
import { budgetTypeLabel, budgetReadJson, budgetFailureMessage } from "@/i18n/budget-presentation";

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useParams, useRouter, usePathname } from "next/navigation";
import { ArrowLeft, Target, TrendingUp, TrendingDown, BarChart3, Settings2, Flame, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { BrandLoader } from "@/components/dashboard/brand-loader";
import { ContentReveal } from "@/components/ui/content-reveal";
import { budgetMoney, budgetPercent, budgetAbs } from "@/lib/money/budget-ui";
import { useEntityTitle } from "@/lib/hooks/use-entity-title";
import { cn } from "@/lib/utils";
import type { PeriodType } from "@/lib/budget-periods";

interface Account {
  id: string;
  code: string;
  name: string;
  type: string;
}

interface BudgetPeriodData {
  id: string;
  label: string;
  startDate: string;
  endDate: string;
  amount: bigint;
  sortOrder: number;
}

interface BudgetLineData {
  id: string;
  accountId: string;
  account: Account | null;
  total: bigint;
  periods: BudgetPeriodData[];
}

interface BudgetData {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  periodType: PeriodType;
  isActive: boolean;
  createdAt: string;
  lines: BudgetLineData[];
}

interface PeriodComparison {
  id: string;
  label: string;
  startDate: string;
  endDate: string;
  budgeted: bigint;
  actual: bigint;
  variance: bigint;
  sortOrder: number;
}

interface Comparison {
  accountId: string;
  accountName: string;
  accountCode: string;
  budgeted: bigint;
  actual: bigint;
  variance: bigint;
  variancePct: number;
  burnRate: bigint;
  projected: bigint;
  periods: PeriodComparison[];
}

interface BudgetContextValue {
  budget: BudgetData;
  currencyCode: string;
  setBudget: (fn: (prev: BudgetData | null) => BudgetData | null) => void;
  comparisons: Comparison[];
  totalBudgeted: bigint;
  totalActual: bigint;
  totalBurnRate: bigint;
  daysElapsed: number;
  daysRemaining: number;
  totalDays: number;
  accounts: Account[];
  refetch: () => void;
}

const BudgetContext = createContext<BudgetContextValue | null>(null);

export function useBudgetContext() {
  const ctx = useContext(BudgetContext);
  if (!ctx) throw new Error("useBudgetContext must be used within budget layout");
  return ctx;
}

export type { BudgetData, BudgetLineData, BudgetPeriodData, Comparison, PeriodComparison, Account };


const PAGE_TABS = [
  { value: "overview", label: "overview", icon: BarChart3, href: (id: string) => `/accounting/budgets/${id}` },
  { value: "settings", label: "settings", icon: Settings2, href: (id: string) => `/accounting/budgets/${id}/settings` },
] as const;

export default function BudgetDetailLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations("Budgets");
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const pathname = usePathname();
  const [currencyCode, setCurrencyCode] = useState("USD");
  const [budget, setBudget] = useState<BudgetData | null>(null);
  const [comparisons, setComparisons] = useState<Comparison[]>([]);
  const [totalBudgeted, setTotalBudgeted] = useState(0n);
  const [totalActual, setTotalActual] = useState(0n);
  const [totalBurnRate, setTotalBurnRate] = useState(0n);
  const [daysElapsed, setDaysElapsed] = useState(0);
  const [daysRemaining, setDaysRemaining] = useState(0);
  const [totalDays, setTotalDays] = useState(0);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);

  useEntityTitle(budget?.name ?? undefined);

  const orgId = typeof window !== "undefined" ? localStorage.getItem("activeOrgId") : null;

  const fetchData = useCallback(() => {
    if (!orgId) return;
    setLoading(true);
    setLoadError("");

    Promise.all([
      fetch(`/api/v1/budgets/${id}`, { headers: { "x-organization-id": orgId } }).then(response => budgetReadJson(response, t, t("detailLoadFailed"))),
      fetch("/api/v1/accounts?limit=500", { headers: { "x-organization-id": orgId } }).then(response => budgetReadJson(response, t, t("detailLoadFailed"))),
      fetch(`/api/v1/reports/budget-vs-actual?budgetId=${id}`, { headers: { "x-organization-id": orgId } }).then(response => budgetReadJson(response, t, t("detailLoadFailed"))),
    ])
      .then(([budgetData, accountsData, reportData]) => {
        if (budgetData.budget) setBudget(budgetData.budget);
        setAccounts(accountsData.accounts || []);
        if (reportData) {
          setCurrencyCode(reportData.currencyCode);
          setComparisons(reportData.comparisons || []);
          setTotalBudgeted(reportData.totalBudgeted ?? 0n);
          setTotalActual(reportData.totalActual ?? 0n);
          setTotalBurnRate(reportData.totalBurnRate ?? 0n);
          setDaysElapsed(reportData.daysElapsed || 0);
          setDaysRemaining(reportData.daysRemaining || 0);
          setTotalDays(reportData.totalDays || 0);
        }
      })
      .catch((error) => { setLoadError(budgetFailureMessage(error, t, t("detailLoadFailed"))); setBudget(null); setComparisons([]); })
      .finally(() => setLoading(false));
  }, [id, orgId, t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) return <BrandLoader />;

  if (!budget) {
    return (
      <div className="space-y-4 pt-12 text-center">
        <p className="text-sm text-muted-foreground">{loadError || t("notFound")}</p>
        <button onClick={() => router.push("/accounting/budgets")} className="text-sm text-muted-foreground underline">{t("backCapital")}</button>
      </div>
    );
  }

  const formatMoney = (amount: bigint) => budgetMoney(amount, currencyCode);
  const grandTotal = budget.lines.reduce((s, l) => s + l.total, 0n);
  const totalVariance = totalBudgeted - totalActual;
  const overallPct = totalBudgeted !== 0n ? budgetPercent(totalActual, totalBudgeted) : 0;
  const activeTab = pathname.endsWith("/settings") ? "settings" : "overview";

  return (
    <BudgetContext.Provider value={{ currencyCode, budget, setBudget, comparisons, totalBudgeted, totalActual, totalBurnRate, daysElapsed, daysRemaining, totalDays, accounts, refetch: fetchData }}>
      <ContentReveal>
        {/* Back link */}
        <button
          onClick={() => router.push("/accounting/budgets")}
          className="flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="size-3.5" />
          {t("back")}
        </button>

        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-purple-500/10 dark:bg-purple-500/15">
              <Target className="size-5 text-purple-700 dark:text-purple-300" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
                <h1 className="text-base sm:text-lg font-semibold tracking-tight">{budget.name}</h1>
                <Badge variant="outline" className={budget.isActive
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                  : "text-muted-foreground"
                }>
                  {budget.isActive ? t("active") : t("inactive")}
                </Badge>
                <Badge variant="outline" className="text-[10px]">
                  {budgetTypeLabel(t, budget.periodType)}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">
                {budget.startDate} · {budget.endDate} · {t("lineCount", { count: budget.lines.length })}
              </p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 mb-8">
          <div>
            <p className="text-[11px] text-muted-foreground">{t("totalBudget")}</p>
            <p className="mt-0.5 font-mono text-xl font-semibold tabular-nums">{formatMoney(grandTotal)}</p>
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground flex items-center gap-1">
              <TrendingUp className="size-3 text-blue-500" />
              {t("actualSpend")}
            </p>
            <p className="mt-0.5 font-mono text-lg font-semibold tabular-nums text-blue-600">
              {totalActual !== 0n ? formatMoney(totalActual) : "-"}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground flex items-center gap-1">
              {totalVariance >= 0
                ? <TrendingDown className="size-3 text-emerald-500" />
                : <TrendingUp className="size-3 text-red-500" />
              }
              {t("variance")}
            </p>
            <p className={cn(
              "mt-0.5 font-mono text-lg font-semibold tabular-nums",
              totalVariance >= 0 ? "text-emerald-600" : "text-red-600"
            )}>
              {totalBudgeted !== 0n ? formatMoney(budgetAbs(totalVariance)) : "-"}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground flex items-center gap-1">
              <Flame className="size-3 text-orange-500" />
              {t("burnRate")}
            </p>
            <p className="mt-0.5 font-mono text-lg font-semibold tabular-nums text-orange-600">
              {totalBurnRate !== 0n ? formatMoney(totalBurnRate) : "-"}
            </p>
            {totalBurnRate !== 0n && (
              <p className="text-[10px] text-muted-foreground">{t("projectedTotal")}</p>
            )}
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground flex items-center gap-1">
              <Clock className="size-3 text-violet-500" />
              {t("daysRemaining")}
            </p>
            <p className="mt-0.5 font-mono text-lg font-semibold tabular-nums">
              {daysRemaining}
            </p>
            <p className="text-[10px] text-muted-foreground">{t("elapsed", { elapsed: daysElapsed, total: totalDays })}</p>
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground">{t("utilization")}</p>
            <div className="flex items-center gap-2 mt-1">
              <div className="h-2 flex-1 rounded-full bg-gray-200 dark:bg-muted overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    overallPct > 100 ? "bg-red-500" : overallPct > 80 ? "bg-amber-500" : "bg-emerald-500"
                  )}
                  style={{ width: `${Math.max(0, Math.min(overallPct, 100))}%` }}
                />
              </div>
              <span className="text-xs font-mono tabular-nums text-muted-foreground">{overallPct}%</span>
            </div>
          </div>
        </div>

        {/* Page tabs */}
        <nav className="-mt-2 mb-8 flex items-center gap-1 overflow-x-auto border-b border-border">
          {PAGE_TABS.map((tab) => {
            const Icon = tab.icon;
            const tabHref = tab.href(id);
            const active = activeTab === tab.value;
            return (
              <button
                key={tab.value}
                onClick={() => router.push(tabHref)}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 border-b-2 px-2.5 pb-2.5 text-[13px] font-medium transition-colors",
                  active
                    ? "border-foreground text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="size-3.5" />
                {t(tab.label)}
              </button>
            );
          })}
        </nav>

        {/* Tab content */}
        <ContentReveal key={pathname}>
          {children}
        </ContentReveal>
      </ContentReveal>
    </BudgetContext.Provider>
  );
}
