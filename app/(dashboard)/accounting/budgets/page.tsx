"use client";
import { usePresentation as useUnitPresentation } from "@/i18n/provider";

import { useTranslations } from "next-intl";
import { budgetTypeLabel, budgetPeriodLabel, budgetReadJson, budgetFailureMessage } from "@/i18n/budget-presentation";

import { useState, useEffect, useCallback } from "react";
import { useDebounce } from "@/lib/hooks/use-debounce";
import { useRouter } from "next/navigation";
import { ChevronRight, Plus, Search, Target, X } from "lucide-react";
import { useCreateDrawer } from "@/components/dashboard/create-drawer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { budgetMoney, budgetPercent, budgetAbs } from "@/lib/money/budget-ui";
import { ContentReveal } from "@/components/ui/content-reveal";
import { BrandLoader } from "@/components/dashboard/brand-loader";
import { cn } from "@/lib/utils";
import { useDocumentTitle } from "@/lib/hooks/use-document-title";

interface Budget {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  periodType: string;
  isActive: boolean;
  createdAt: string;
  lines?: { total: bigint }[];
}

interface PeriodBreakdown {
  label: string;
  startDate: string;
  endDate: string;
  budgeted: bigint;
  actual: bigint;
  variance: bigint;
}

interface LineComparison {
  accountId: string;
  accountName: string;
  accountCode: string;
  budgeted: bigint;
  actual: bigint;
  variance: bigint;
  periods: PeriodBreakdown[];
}

interface BudgetReport {
  currencyCode: string;
  totalBudgeted: bigint;
  totalActual: bigint;
  daysElapsed: number;
  daysRemaining: number;
  totalDays: number;
  comparisons: LineComparison[];
}


function getCurrentPeriod(periods: PeriodBreakdown[]): PeriodBreakdown | undefined {
  const today = new Date().toISOString().slice(0, 10);
  return periods.find((p) => p.startDate <= today && p.endDate >= today);
}

export default function BudgetsPage() {
  const unitPresentation = useUnitPresentation();
  const t = useTranslations("Budgets");
  const router = useRouter();
  const { open: openDrawer } = useCreateDrawer();
  const [loadError, setLoadError] = useState("");
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState<Record<string, BudgetReport>>({});
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search);
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [loadingReports, setLoadingReports] = useState(false);

  useDocumentTitle(t("documentTitle"));

  const fetchData = useCallback(() => {
    const orgId = localStorage.getItem("activeOrgId");
    if (!orgId) return;
    setLoading(true);
    setLoadError("");
    fetch("/api/v1/budgets?limit=100", {
      headers: { "x-organization-id": orgId },
    })
      .then(response => budgetReadJson(response, t, t("loadFailed")))
      .then((data) => {
        if (data.data) {
          setBudgets(data.data);
          setLoading(false);

          // Fetch reports in the background after list is shown
          setLoadingReports(true);
          const active = (data.data as Budget[]).slice(0, 10);
          Promise.all(
            active.map((b) =>
              fetch(`/api/v1/reports/budget-vs-actual?budgetId=${b.id}`, {
                headers: { "x-organization-id": orgId },
              })
                .then(response => budgetReadJson(response, t, t("loadFailed")))
                .then((d) => [b.id, {
                  currencyCode: d.currencyCode,
                  totalBudgeted: d.totalBudgeted as bigint,
                  totalActual: d.totalActual as bigint,
                  daysElapsed: d.daysElapsed as number,
                  daysRemaining: d.daysRemaining as number,
                  totalDays: d.totalDays as number,
                  comparisons: (d.comparisons || []) as LineComparison[],
                }] as const)
                .catch(() => null)
            )
          ).then((results) => {
            const map: Record<string, BudgetReport> = {};
            for (const r of results) {
              if (r) map[r[0]] = r[1];
            }
            setReports(map);
            setLoadingReports(false);
          });
        } else {
          setLoading(false);
        }
      })
      .catch(error => { setBudgets([]); setLoadError(budgetFailureMessage(error, t, t("loadFailed"))); setLoading(false); });
  }, [t]);

  useEffect(() => {
    fetchData();
    window.addEventListener("budgets-changed", fetchData);
    return () => window.removeEventListener("budgets-changed", fetchData);
  }, [fetchData]);

  if (loading) return <BrandLoader />;
  if (loadError) return <p role="alert" className="text-sm text-destructive">{loadError}</p>;

  if (budgets.length === 0) {
    return (
      <ContentReveal className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight">{t("budgets")}</h2>
          <Button
            onClick={() => openDrawer("budget")}
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            <Plus className="mr-2 size-4" />
            {t("new")}
          </Button>
        </div>

        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-4 border-b">
            <Target className="size-4 text-muted-foreground" />
            <div>
              <p className="text-sm font-semibold">{t("tracking")}</p>
              <p className="text-xs text-muted-foreground">{t("trackingDescription")}</p>
            </div>
          </div>
          <div className="p-5 space-y-5 opacity-40">
            {[
              { label: t("marketing"), pct: 65 },
              { label: t("operations"), pct: 82 },
              { label: t("engineering"), pct: 40 },
              { label: t("sales"), pct: 55 },
            ].map(({ label, pct }) => (
              <div key={label} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">{label}</span>
                  <span className={cn("text-xs font-medium", pct > 80 ? "text-amber-500/70" : "text-emerald-500/70")}>{pct}%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn("h-full rounded-full", pct > 80 ? "bg-amber-500/50" : "bg-emerald-500/50")}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </ContentReveal>
    );
  }

  const filtered = budgets.filter((b) => {
    if (statusFilter === "active" && !b.isActive) return false;
    if (statusFilter === "inactive" && b.isActive) return false;
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      const matchName = b.name.toLowerCase().includes(q);
      const matchPeriod = budgetTypeLabel(t, b.periodType).toLowerCase().includes(q);
      const matchAccount = reports[b.id]?.comparisons?.some(
        (c) => c.accountName.toLowerCase().includes(q) || c.accountCode.toLowerCase().includes(q)
      );
      if (!matchName && !matchPeriod && !matchAccount) return false;
    }
    return true;
  });

  const activeBudgets = filtered.filter((b) => b.isActive);
  const inactiveBudgets = filtered.filter((b) => !b.isActive);
  const totalActive = budgets.filter((b) => b.isActive).length;
  const hasFilters = search !== "" || statusFilter !== "all";

  return (
    <ContentReveal className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">{t("budgets")}</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {t("count", { count: budgets.length, active: totalActive })}
          </p>
        </div>
        <Button
          onClick={() => openDrawer("budget")}
          size="sm"
          className="bg-emerald-600 hover:bg-emerald-700"
        >
          <Plus className="mr-2 size-4" />
          {t("new")}
        </Button>
      </div>

      {/* Search + Filter */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder={t("search")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as "all" | "active" | "inactive")}>
          <SelectTrigger className="h-9 w-32 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("all")}</SelectItem>
            <SelectItem value="active">{t("active")}</SelectItem>
            <SelectItem value="inactive">{t("inactive")}</SelectItem>
          </SelectContent>
        </Select>
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs text-muted-foreground"
            onClick={() => { setSearch(""); setStatusFilter("all"); }}
          >
            <X className="mr-1 size-3" />
            {t("clear")}
          </Button>
        )}
      </div>

      <ContentReveal key={`${debouncedSearch}_${statusFilter}`}>
      {/* No results */}
      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-sm text-muted-foreground">{t("noResults")}</p>
          <Button
            variant="ghost"
            size="sm"
            className="mt-2 text-xs"
            onClick={() => { setSearch(""); setStatusFilter("all"); }}
          >
            {t("clearFilters")}
          </Button>
        </div>
      )}

      {/* Active budgets */}
      {activeBudgets.length > 0 && (
        <div className="space-y-3">
          {activeBudgets.map((b) => {
            const report = reports[b.id];
            if (!report) return <button key={b.id} onClick={() => router.push(`/accounting/budgets/${b.id}`)} className="w-full rounded-lg border p-4 text-left">
              <span className="text-sm font-semibold">{b.name}</span>
              <span className="block text-xs text-muted-foreground">{loadingReports ? t("loadingAmounts") : t("amountsUnavailable")}</span>
            </button>;
            const formatMoney = (amount: bigint) => budgetMoney(amount, report.currencyCode, unitPresentation);
            const total = b.lines?.reduce((s, l) => s + l.total, 0n) ?? 0n;
            const budgeted = report?.totalBudgeted ?? total;
            const actual = report?.totalActual ?? 0n;
            const pct = budgeted === 0n ? 0 : budgetPercent(actual, budgeted);
            const over = actual > budgeted;
            const remaining = budgeted - actual;
            const daysRemaining = report?.daysRemaining ?? 0;
            const totalDays = report?.totalDays ?? 0;
            const daysElapsed = report?.daysElapsed ?? 0;
            const timePct = totalDays > 0 ? Math.round((daysElapsed / totalDays) * 100) : 0;
            const lines = report?.comparisons || [];

            return (
              <div key={b.id} className="rounded-lg border bg-card overflow-hidden">
                {/* Budget header */}
                <button
                  onClick={() => router.push(`/accounting/budgets/${b.id}`)}
                  className="w-full px-4 py-3 text-left hover:bg-muted/50 transition-colors group"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <p className="text-sm font-semibold truncate">{b.name}</p>
                      <Badge variant="outline" className="text-[10px] shrink-0">
                        {budgetTypeLabel(t, b.periodType)}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <p className="text-sm font-mono font-semibold tabular-nums">
                          {formatMoney(actual)} <span className="text-muted-foreground font-normal">/ {formatMoney(budgeted)}</span>
                        </p>
                        <div className="flex items-center gap-2 justify-end text-[11px] text-muted-foreground">
                          <span className={cn(
                            "font-mono tabular-nums",
                            over ? "text-red-600" : "text-emerald-600"
                          )}>
                            {over ? t("overBy", { amount: formatMoney(budgetAbs(remaining)) }) : t("left", { amount: formatMoney(remaining) })}
                          </span>
                          <span>·</span>
                          <span>{t("timeLeft", { days: daysRemaining, percent: timePct })}</span>
                        </div>
                      </div>
                      <ChevronRight className="size-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </div>

                  {/* Overall progress */}
                  <div className="mt-2 h-1.5 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all",
                        over ? "bg-red-500" : pct > 80 ? "bg-amber-500" : "bg-emerald-500"
                      )}
                      style={{ width: `${Math.max(0, Math.min(pct, 100))}%` }}
                    />
                  </div>
                </button>

                {/* Per-line breakdown */}
                {lines.length > 0 ? (
                  <ContentReveal className="border-t divide-y">
                    {lines.map((line) => {
                      const linePct = line.budgeted === 0n ? 0 : budgetPercent(line.actual, line.budgeted);
                      const lineOver = line.actual > line.budgeted;
                      const currentPeriod = getCurrentPeriod(line.periods);
                      const periodRemaining = currentPeriod ? currentPeriod.budgeted - currentPeriod.actual : null;
                      const periodOver = currentPeriod ? currentPeriod.actual > currentPeriod.budgeted : false;

                      return (
                        <div key={line.accountId} className="px-4 py-2 flex items-center gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              {line.accountCode && (
                                <span className="text-[11px] text-muted-foreground font-mono shrink-0">{line.accountCode}</span>
                              )}
                              <span className="text-[13px] truncate">{line.accountName}</span>
                            </div>
                            <div className="mt-1 h-1 w-full rounded-full bg-muted overflow-hidden">
                              <div
                                className={cn(
                                  "h-full rounded-full",
                                  lineOver ? "bg-red-500" : linePct > 80 ? "bg-amber-500" : "bg-emerald-500"
                                )}
                                style={{ width: `${Math.max(0, Math.min(linePct, 100))}%` }}
                              />
                            </div>
                          </div>

                          {currentPeriod && (
                            <div className="text-right shrink-0">
                              <p className={cn(
                                "text-[11px] font-mono tabular-nums",
                                periodOver ? "text-red-600" : "text-emerald-600"
                              )}>
                                {periodOver
                                  ? "+" + formatMoney(budgetAbs(periodRemaining!))
                                  : formatMoney(periodRemaining!)
                                }
                              </p>
                              <p className="text-[10px] text-muted-foreground">{t("leftIn", { period: budgetPeriodLabel(t, currentPeriod.label) })}</p>
                            </div>
                          )}

                          <div className="text-right shrink-0 min-w-[80px]">
                            <p className="text-[11px] font-mono tabular-nums font-medium">
                              {formatMoney(line.actual)} <span className="text-muted-foreground font-normal">/ {formatMoney(line.budgeted)}</span>
                            </p>
                            <p className={cn(
                              "text-[10px] font-mono tabular-nums",
                              lineOver ? "text-red-600" : "text-muted-foreground"
                            )}>
                              {linePct}%
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </ContentReveal>
                ) : loadingReports ? (
                  <div className="border-t px-4 py-3 space-y-2.5">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="flex items-center gap-3 animate-pulse">
                        <div className="flex-1 space-y-1.5">
                          <div className="h-3 w-32 rounded bg-muted" />
                          <div className="h-1 w-full rounded-full bg-muted" />
                        </div>
                        <div className="h-3 w-16 rounded bg-muted" />
                        <div className="h-3 w-20 rounded bg-muted" />
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      {/* Inactive budgets */}
      {inactiveBudgets.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("inactive")}</p>
          <div className="rounded-lg border overflow-hidden">
            <div className="divide-y">
              {inactiveBudgets.map((b) => {
                const report = reports[b.id];
                const total = report?.totalBudgeted;
                return (
                  <button
                    key={b.id}
                    onClick={() => router.push(`/accounting/budgets/${b.id}`)}
                    className="w-full flex items-center gap-4 px-4 py-2.5 text-left hover:bg-muted/50 transition-colors group"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate text-muted-foreground">{b.name}</p>
                        <Badge variant="outline" className="text-[10px] shrink-0">{t("inactive")}</Badge>
                        {b.periodType && b.periodType !== "monthly" && (
                          <Badge variant="outline" className="text-[10px] shrink-0">
                            {budgetTypeLabel(t, b.periodType)}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {b.startDate} · {b.endDate}
                      </p>
                    </div>
                    <span className="font-mono text-sm font-medium tabular-nums shrink-0 text-muted-foreground">
                      {total === undefined ? t("unavailable") : budgetMoney(total, report.currencyCode, unitPresentation)}
                    </span>
                    <ChevronRight className="size-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
      </ContentReveal>
    </ContentReveal>
  );
}
