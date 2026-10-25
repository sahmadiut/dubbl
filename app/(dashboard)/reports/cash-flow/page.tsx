"use client";

import { BidiText, IdentifierText } from "@/components/ui/bidi-text";

import { usePresentation } from "@/i18n/provider";
import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { ArrowDownUp, TrendingUp, TrendingDown, DollarSign } from "lucide-react";
import { BrandLoader } from "@/components/dashboard/brand-loader";
import { ContentReveal } from "@/components/ui/content-reveal";
import { PageHeader } from "@/components/dashboard/page-header";
import { DataTable, type Column } from "@/components/dashboard/data-table";
import { StatCard } from "@/components/dashboard/stat-card";
import { DateRangeFilter } from "@/components/dashboard/date-range-filter";
import { ledgerAgingJson, cashFlowUi, reportUiMoney, type CashFlowUi } from "@/lib/money/ledger-aging-ui";
import { ErrorState } from "@/components/dashboard/error-state";
import { BackToReports, ReportHelp } from "../_components";

type CashFlowRow = CashFlowUi["operating"][number] & { currencyCode: string };

export default function CashFlowPage() {
  const presentation = usePresentation();
  const t = useTranslations("BalanceCashReports");
  const columns: Column<CashFlowRow>[] = [
    { key: "code", header: t("code"), className: "w-24", render: (r) => <span className="font-mono text-sm"><IdentifierText>{r.accountCode}</IdentifierText></span> },
    { key: "name", header: t("account"), render: (r) => <span className="text-sm font-medium"><BidiText>{r.accountName}</BidiText></span> },
    { key: "amount", header: t("amount"), className: "w-32 text-end", render: (r) => <span className="font-mono text-sm tabular-nums"><IdentifierText>{reportUiMoney(r.amount, r.currencyCode, presentation)}</IdentifierText></span> },
  ];
  const now = new Date();
  const [initialLoad, setInitialLoad] = useState(true);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(`${now.getFullYear()}-01-01`);
  const [endDate, setEndDate] = useState(now.toISOString().slice(0, 10));
  const [data, setData] = useState<CashFlowUi | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const orgId = localStorage.getItem("activeOrgId");
    if (!orgId) return;
    let cancelled = false;
    setLoading(true);
    setError(false);
    const params = new URLSearchParams({ startDate, endDate });
    fetch(`/api/v1/reports/cash-flow?${params}`, {
      headers: { "x-organization-id": orgId },
    })
      .then((r) => ledgerAgingJson(r, cashFlowUi))
      .then((data) => {
        if (cancelled) return;
        setData(data);
      })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
          setInitialLoad(false);
        }
      });
    return () => { cancelled = true; };
  }, [startDate, endDate]);

  const currencyCode = data?.currencyCode ?? "USD";
  const rows = (items: CashFlowUi["operating"]) => items.map(row => ({ ...row, currencyCode }));
  const operating = rows(data?.operating ?? []), investing = rows(data?.investing ?? []), financing = rows(data?.financing ?? []);
  const totalOperating = data?.totalOperating ?? 0n, totalInvesting = data?.totalInvesting ?? 0n;
  const totalFinancing = data?.totalFinancing ?? 0n, netCashFlow = data?.netCashFlow ?? 0n;
  const formatMoney = (amount: bigint) => reportUiMoney(amount, currencyCode, presentation);

  const sections = [
    {
      key: "operating",
      title: t("cash_operating"),
      help: t("cashHelp_operating"),
      data: operating,
      total: totalOperating,
      icon: ArrowDownUp,
    },
    {
      key: "investing",
      title: t("cash_investing"),
      help: t("cashHelp_investing"),
      data: investing,
      total: totalInvesting,
      icon: TrendingDown,
    },
    {
      key: "financing",
      title: t("cash_financing"),
      help: t("cashHelp_financing"),
      data: financing,
      total: totalFinancing,
      icon: TrendingUp,
    },
  ] as const;

  if (initialLoad) return <BrandLoader />;
  if (error) return <ErrorState message={t("loadFailed")} onRetry={() => window.location.reload()} />;

  return (
    <ContentReveal className="space-y-6">
      <BackToReports />

      <PageHeader
        title={t("cashTitle")}
        description={t("cashDescription")}
      />

      <ReportHelp>
        {t("cashHelp")}
      </ReportHelp>

      <DateRangeFilter
        startDate={startDate}
        endDate={endDate}
        onDateChange={(s, e) => { setStartDate(s); setEndDate(e); }}
      />

      {loading ? (
        <BrandLoader className="h-48" />
      ) : (
        <ContentReveal>
          <div className="space-y-6">
            <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
              {sections.map((s) => (
                <StatCard
                  key={s.key}
                  title={s.title}
                  value={formatMoney(s.total)}
                  icon={s.icon}
                  changeType={s.total >= 0n ? "positive" : "negative"}
                />
              ))}
              <StatCard
                title={t("changeInCash")}
                value={formatMoney(netCashFlow)}
                icon={DollarSign}
                changeType={netCashFlow >= 0n ? "positive" : "negative"}
              />
            </div>

            {sections.map((s) => (
              <div key={s.key} className="space-y-2">
                <div>
                  <h2 className="text-lg font-semibold"><BidiText>{s.title}</BidiText></h2>
                  <p className="text-[13px] text-muted-foreground">{s.help}</p>
                </div>
                <DataTable columns={columns} data={s.data} loading={false} emptyMessage={t(`cashEmpty_${s.key}`)} />
                <div className="flex flex-wrap gap-2 justify-between px-3 py-2 sm:px-4 bg-muted/50 rounded-lg text-sm font-semibold">
                  <span>{t(`cashTotal_${s.key}`)}</span>
                  <span className="font-mono tabular-nums"><IdentifierText>{formatMoney(s.total)}</IdentifierText></span>
                </div>
              </div>
            ))}

            <div className="flex flex-wrap gap-2 justify-between px-3 py-2 sm:px-4 sm:py-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg font-semibold text-sm sm:text-base">
              <span>{t("totalCashChange")}</span>
              <span className="font-mono tabular-nums"><IdentifierText>{formatMoney(netCashFlow)}</IdentifierText></span>
            </div>
          </div>
        </ContentReveal>
      )}
    </ContentReveal>
  );
}
