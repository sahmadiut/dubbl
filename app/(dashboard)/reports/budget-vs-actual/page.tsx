"use client";

import { BidiText, IdentifierText } from "@/components/ui/bidi-text";

import { usePresentation } from "@/i18n/provider";
import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { BackToReports } from "../_components";
import { DollarSign, Target } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { DataTable, type Column } from "@/components/dashboard/data-table";
import { StatCard } from "@/components/dashboard/stat-card";
import { BudgetProgressBar } from "@/components/dashboard/budget-progress-bar";
import { EmptyState } from "@/components/dashboard/empty-state";
import { BrandLoader } from "@/components/dashboard/brand-loader";
import { ContentReveal } from "@/components/ui/content-reveal";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { budgetMoney as formatMoney, budgetJson } from "@/lib/money/budget-ui";

interface Budget {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
}

interface Comparison {
  currencyCode: string;
  accountId: string;
  accountName: string;
  accountCode: string;
  budgeted: bigint;
  actual: bigint;
  variance: bigint;
  variancePct: number;
}

export default function BudgetVsActualPage() {
  const presentation = usePresentation();
  const t = useTranslations("AnalyticalReports");
  const columns: Column<Comparison>[] = [
    { key: "code", header: t("code"), className: "w-24", render: (r) => <span className="font-mono text-sm"><IdentifierText>{r.accountCode}</IdentifierText></span> },
    { key: "name", header: t("account"), render: (r) => <span className="text-sm font-medium"><BidiText>{r.accountName}</BidiText></span> },
    { key: "budgeted", header: t("budgeted"), className: "w-28 text-end", render: (r) => <span className="font-mono text-sm tabular-nums"><IdentifierText>{formatMoney(r.budgeted, r.currencyCode, presentation)}</IdentifierText></span> },
    { key: "actual", header: t("actual"), className: "w-28 text-end", render: (r) => <span className="font-mono text-sm tabular-nums"><IdentifierText>{formatMoney(r.actual, r.currencyCode, presentation)}</IdentifierText></span> },
    { key: "variance", header: t("variance"), className: "w-28 text-end", render: (r) => (
      <span className={`font-mono text-sm tabular-nums ${r.variance >= 0 ? "text-emerald-600" : "text-red-600"}`}><IdentifierText>
        {formatMoney(r.variance, r.currencyCode, presentation)}
      </IdentifierText></span>
    )},
    { key: "pct", header: "%", className: "w-20 text-end", render: (r) => (
      <span className={`text-sm tabular-nums ${r.variance >= 0 ? "text-emerald-600" : "text-red-600"}`}><IdentifierText>
        {r.variancePct}%
      </IdentifierText></span>
    )},
  ];
  const [loadError, setLoadError] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const [loading, setLoading] = useState(true);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [selectedBudgetId, setSelectedBudgetId] = useState<string>("");
  const [currencyCode, setCurrencyCode] = useState("USD");
  const [comparisons, setComparisons] = useState<Comparison[]>([]);
  const [totalBudgeted, setTotalBudgeted] = useState(0n);
  const [totalActual, setTotalActual] = useState(0n);
  const [totalVariance, setTotalVariance] = useState(0n);
  const [reportLoading, setReportLoading] = useState(false);

  // Fetch budget list
  useEffect(() => {
    const orgId = localStorage.getItem("activeOrgId");
    if (!orgId) return;
    let cancelled = false;
    fetch("/api/v1/budgets?limit=100", {
      headers: { "x-organization-id": orgId },
    })
      .then(budgetJson)
      .then((data) => {
        if (cancelled) return;
        const list = data.data || [];
        setBudgets(list);
        if (list.length > 0) {
          setSelectedBudgetId(list[0].id);
        }
      })
      .catch(() => { if (!cancelled) setLoadError(true); })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
          setInitialLoad(false);
        }
      });
    return () => { cancelled = true; };
  }, []);

  // Fetch report when budget selected
  useEffect(() => {
    if (!selectedBudgetId) return;
    const orgId = localStorage.getItem("activeOrgId");
    if (!orgId) return;
    let cancelled = false;
    setReportLoading(true);
    setLoadError(false);
    fetch(`/api/v1/reports/budget-vs-actual?budgetId=${selectedBudgetId}`, {
      headers: { "x-organization-id": orgId },
    })
      .then(budgetJson)
      .then((data) => {
        if (cancelled) return;
        setCurrencyCode(data.currencyCode);
        setComparisons((data.comparisons || []).map((row: Comparison) => ({ ...row, currencyCode: data.currencyCode })));
        setTotalBudgeted(data.totalBudgeted ?? 0n);
        setTotalActual(data.totalActual ?? 0n);
        setTotalVariance(data.totalVariance ?? 0n);
      })
      .catch(() => { if (!cancelled) { setLoadError(true); setComparisons([]); } })
      .finally(() => { if (!cancelled) setReportLoading(false); });
    return () => { cancelled = true; };
  }, [selectedBudgetId]);

  if (initialLoad) return <BrandLoader />;

  if (loadError) return <p role="alert" className="text-sm text-destructive">{t("loadFailed")}</p>;

  if (budgets.length === 0) {
    return (
      <ContentReveal className="space-y-6">
        <BackToReports />
        <PageHeader title={t("budgetTitle")} description={t("budgetDescription")} />
        <EmptyState
          icon={Target}
          title={t("noBudgets")}
          description={t("noBudgetsDescription")}
        />
      </ContentReveal>
    );
  }

  return (
    <ContentReveal className="space-y-6">
      <BackToReports />

      <PageHeader
        title={t("budgetTitle")}
        description={t("budgetDescription")}
      />

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <label htmlFor="report-budget" className="text-sm font-medium">{t("budgetLabel")}</label>
        <Select value={selectedBudgetId} onValueChange={setSelectedBudgetId}>
          <SelectTrigger id="report-budget" className="h-9 w-full sm:w-auto data-[size=default]:h-auto min-h-9 max-w-full whitespace-normal [&_[data-slot=select-value]]:line-clamp-none [&_[data-slot=select-value]]:whitespace-normal [&_[data-slot=select-value]]:text-start">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {budgets.map((b) => (
              <SelectItem key={b.id} value={b.id}><BidiText>{b.name}</BidiText></SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard title={t("totalBudgeted")} value={formatMoney(totalBudgeted, currencyCode, presentation)} icon={Target} />
        <StatCard title={t("totalActual")} value={formatMoney(totalActual, currencyCode, presentation)} icon={DollarSign} />
        <StatCard
          title={t("variance")}
          value={formatMoney(totalVariance, currencyCode, presentation)}
          icon={DollarSign}
          changeType={totalVariance >= 0 ? "positive" : "negative"}
        />
      </div>

      {reportLoading ? (
        <BrandLoader className="h-48" />
      ) : (
        <ContentReveal>
          {comparisons.length > 0 && (
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 mb-6">
              {comparisons.slice(0, 6).map((c) => (
                <div key={c.accountId} className="rounded-lg border bg-card p-4">
                  <BudgetProgressBar
                    budgeted={c.budgeted}
                    actual={c.actual}
                    currencyCode={currencyCode}
                    label={c.accountName}
                  />
                </div>
              ))}
            </div>
          )}

          <DataTable
            columns={columns}
            data={comparisons}
            loading={loading || reportLoading}
            emptyMessage={t("noBudgetLines")}
          />

          <div className="flex flex-wrap gap-2 justify-between px-3 py-2 sm:px-4 sm:py-3 bg-muted/50 rounded-lg text-sm font-semibold mt-6">
            <span>{t("totalVariance")}</span>
            <span className={`font-mono tabular-nums ${totalVariance >= 0 ? "text-emerald-600" : "text-red-600"}`}><IdentifierText>
              {formatMoney(totalVariance, currencyCode, presentation)}
            </IdentifierText></span>
          </div>
        </ContentReveal>
      )}
    </ContentReveal>
  );
}
