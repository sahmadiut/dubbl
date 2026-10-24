"use client";

import { usePresentation } from "@/i18n/provider";
import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { TrendingUp, TrendingDown, DollarSign } from "lucide-react";
import { BrandLoader } from "@/components/dashboard/brand-loader";
import { ErrorState } from "@/components/dashboard/error-state";
import { financialStatementJson, profitLossUi, statementUiMoney, type ProfitLossUi } from "@/lib/money/financial-statement-ui";
import { ContentReveal } from "@/components/ui/content-reveal";
import { PageHeader } from "@/components/dashboard/page-header";
import { DataTable, type Column } from "@/components/dashboard/data-table";
import { StatCard } from "@/components/dashboard/stat-card";
import { DateRangeFilter } from "@/components/dashboard/date-range-filter";
import { Button } from "@/components/ui/button";
import { ExportButton } from "@/components/dashboard/export-button";
import { BackToReports, ReportHelp, BasisToggle } from "../_components";

type AccountRow = ProfitLossUi["revenue"][number];

export default function ProfitAndLossPage() {
  const presentation = usePresentation();
  const t = useTranslations("IncomeReports");
  const now = new Date();
  const [initialLoad, setInitialLoad] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [startDate, setStartDate] = useState(`${now.getFullYear()}-01-01`);
  const [endDate, setEndDate] = useState(now.toISOString().slice(0, 10));
  const [basis, setBasis] = useState<"accrual" | "cash">("accrual");
  const [currencyCode, setCurrencyCode] = useState("USD");
  const columns: Column<AccountRow>[] = [
    { key: "code", header: t("code"), className: "w-24", render: (r) => <span className="font-mono text-sm">{r.accountCode}</span> },
    { key: "name", header: t("account"), render: (r) => <span className="text-sm font-medium">{r.accountName}</span> },
    { key: "balance", header: t("amount"), className: "w-32 text-right", render: (r) => <span className="font-mono text-sm tabular-nums">{statementUiMoney(r.balance, currencyCode, presentation)}</span> },
  ];
  const formatMoney = (value: bigint) => statementUiMoney(value, currencyCode, presentation);
  const [revenue, setRevenue] = useState<AccountRow[]>([]);
  const [expenses, setExpenses] = useState<AccountRow[]>([]);
  const [totalRevenue, setTotalRevenue] = useState(0n);
  const [totalExpenses, setTotalExpenses] = useState(0n);
  const [netIncome, setNetIncome] = useState(0n);

  useEffect(() => {
    const orgId = localStorage.getItem("activeOrgId");
    if (!orgId) return;
    let cancelled = false;
    setLoading(true);
    setError(false);
    const params = new URLSearchParams({ startDate, endDate, basis });
    fetch(`/api/v1/reports/profit-and-loss?${params}`, {
      headers: { "x-organization-id": orgId },
    })
      .then((r) => financialStatementJson(r, profitLossUi))
      .then((data) => {
        if (cancelled) return;
        setCurrencyCode(data.currencyCode);
        setRevenue(data.revenue);
        setExpenses(data.expenses);
        setTotalRevenue(data.totalRevenue);
        setTotalExpenses(data.totalExpenses);
        setNetIncome(data.netIncome);
      })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
          setInitialLoad(false);
        }
      });
    return () => { cancelled = true; };
  }, [startDate, endDate, basis]);

  if (initialLoad) return <BrandLoader />;
  if (error) return <ErrorState message={t("loadFailed")} onRetry={() => window.location.reload()} />;

  return (
    <ContentReveal className="space-y-6">
      <BackToReports />

      <PageHeader
        title={t("profitLossTitle")}
        description={t("profitLossDescription")}
      >
        <a
          href={`/api/v1/reports/profit-and-loss?${new URLSearchParams({ startDate, endDate, basis, format: "pdf" })}`}
          className="inline-flex h-8 items-center rounded-md border px-3 text-sm font-medium hover:bg-muted"
        >
          {t("downloadPdf")}
        </a>
        <ExportButton
          data={[...revenue.map((r) => ({ ...r, section: "Money in", currencyCode, balanceMinor: r.balance.toString() })), ...expenses.map((e) => ({ ...e, section: "Money out", currencyCode, balanceMinor: e.balance.toString() }))]}
          columns={["section", "accountCode", "accountName", "currencyCode", "balanceMinor"]}
          filename="profit-and-loss"
        />
      </PageHeader>

      <ReportHelp>
        {t("profitLossHelp")}
      </ReportHelp>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <DateRangeFilter
          startDate={startDate}
          endDate={endDate}
          onDateChange={(s, e) => { setStartDate(s); setEndDate(e); }}
        />
        <BasisToggle basis={basis} onChange={setBasis} />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline" size="sm">
          <a href="/reports/pnl-comparison">{t("comparePeriods")}</a>
        </Button>
        <Button asChild variant="outline" size="sm">
          <a href="/reports/tracking">{t("splitByTeam")}</a>
        </Button>
      </div>

      {loading ? (
        <BrandLoader className="h-48" />
      ) : (
        <ContentReveal>
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-3">
              <StatCard title={t("moneyIn")} value={formatMoney(totalRevenue)} icon={TrendingUp} changeType="positive" />
              <StatCard title={t("moneyOut")} value={formatMoney(totalExpenses)} icon={TrendingDown} changeType="negative" />
              <StatCard
                title={t("profitShort")}
                value={formatMoney(netIncome)}
                icon={DollarSign}
                changeType={netIncome >= 0 ? "positive" : "negative"}
              />
            </div>

            <div className="space-y-2">
              <h2 className="text-lg font-semibold">{t("moneyIn")}</h2>
              <DataTable columns={columns} data={revenue} loading={false} emptyMessage={t("emptyIncome")} />
              <div className="flex justify-between px-3 py-2 sm:px-4 bg-muted/50 rounded-lg text-sm font-semibold">
                <span>{t("totalMoneyIn")}</span>
                <span className="font-mono tabular-nums">{formatMoney(totalRevenue)}</span>
              </div>
            </div>

            <div className="space-y-2">
              <h2 className="text-lg font-semibold">{t("moneyOut")}</h2>
              <DataTable columns={columns} data={expenses} loading={false} emptyMessage={t("emptyCosts")} />
              <div className="flex justify-between px-3 py-2 sm:px-4 bg-muted/50 rounded-lg text-sm font-semibold">
                <span>{t("totalMoneyOut")}</span>
                <span className="font-mono tabular-nums">{formatMoney(totalExpenses)}</span>
              </div>
            </div>

            <div className="flex justify-between px-3 py-2 sm:px-4 sm:py-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg font-semibold text-sm sm:text-base">
              <span>{t("profit")}</span>
              <span className="font-mono tabular-nums">{formatMoney(netIncome)}</span>
            </div>
          </div>
        </ContentReveal>
      )}
    </ContentReveal>
  );
}
