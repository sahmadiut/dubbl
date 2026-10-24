"use client";

import { usePresentation } from "@/i18n/provider";
import { currencyLabel } from "@/i18n/currency-labels";
import { formatExactDecimal } from "@/i18n/numbers";
import { paymentPerformanceUi, analyticalReportJson } from "@/lib/money/analytical-report-ui";
import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { TrendingUp, TrendingDown } from "lucide-react";
import { BrandLoader } from "@/components/dashboard/brand-loader";
import { ContentReveal } from "@/components/ui/content-reveal";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { DateRangeFilter } from "@/components/dashboard/date-range-filter";
import { money, toMajorDecimal } from "@/lib/money/exact";
import { CurrencySelect } from "@/components/ui/currency-select";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ExportButton } from "@/components/dashboard/export-button";
import { BackToReports } from "../_components";

interface PerformanceEntry {
  contactId: string;
  contactName: string;
  avgDays: number;
  avgTermDays: number;
  invoiceCount?: number;
  billCount?: number;
  totalCollected?: bigint;
  totalCollectedMinor?: string;
  totalPaid?: bigint;
  totalPaidMinor?: string;
  lateCount: number;
  onTimeRate: number;
}

export default function PaymentPerformancePage() {
  const t = useTranslations("AgingVendorReports");
  const now = new Date();
  const [initialLoad, setInitialLoad] = useState(true);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(`${now.getFullYear()}-01-01`);
  const [endDate, setEndDate] = useState(now.toISOString().slice(0, 10));
  const [receivables, setReceivables] = useState<PerformanceEntry[]>([]);
  const [payables, setPayables] = useState<PerformanceEntry[]>([]);
  const [avgCollect, setAvgCollect] = useState(0);
  const [avgPay, setAvgPay] = useState(0);
  const [currencyFilter, setCurrencyFilter] = useState("");
  const [currencyCode, setCurrencyCode] = useState("USD");
  const [error, setError] = useState(false);

  useEffect(() => {
    const orgId = localStorage.getItem("activeOrgId");
    if (!orgId) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    const params = new URLSearchParams({ startDate, endDate });
    if (currencyFilter) params.set("currencyCode", currencyFilter);
    fetch(`/api/v1/reports/payment-performance?${params}`, {
      headers: { "x-organization-id": orgId },
    })
      .then((r) => analyticalReportJson(r, paymentPerformanceUi))
      .then((data) => {
        if (cancelled) return;
        setReceivables(data.receivables || []);
        setPayables(data.payables || []);
        setAvgCollect(data.avgDaysToCollect || 0);
        setAvgPay(data.avgDaysToPay || 0);
        setCurrencyCode(data.currencyCode);
        setError(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError(true);
        setReceivables([]);
        setPayables([]);
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
          setInitialLoad(false);
        }
      });
    return () => { cancelled = true; };
  }, [startDate, endDate, currencyFilter]);

  if (initialLoad) return <BrandLoader />;

  return (
    <ContentReveal className="space-y-6">
      <BackToReports />

      <PageHeader title={t("perfTitle")} description={t("perfDescription")}>
        <ExportButton
          data={loading || error ? [] : [...receivables.map((r) => ({ ...r, currencyCode, type: "receivable" })), ...payables.map((p) => ({ ...p, currencyCode, type: "payable" }))]}
          columns={["type", "contactName", "currencyCode", "avgDays", "avgTermDays", "invoiceCount", "billCount", "totalCollectedMinor", "totalPaidMinor", "lateCount", "onTimeRate"]}
          filename="payment-performance"
        />
      </PageHeader>

      <DateRangeFilter startDate={startDate} endDate={endDate} onDateChange={(s, e) => { setStartDate(s); setEndDate(e); }} />
      <div className="flex items-center gap-3">
        <span className="text-sm">{t("documentCurrency")}</span>
        <CurrencySelect value={currencyFilter} onValueChange={setCurrencyFilter} compact />
        {currencyFilter && <Button variant="ghost" size="sm" onClick={() => setCurrencyFilter("")}>{t("clearFilter")}</Button>}
      </div>

      {loading ? (
        <BrandLoader className="h-48" />
      ) : error ? (
        <p role="alert" className="text-sm text-red-600">{t("loadFailed")}</p>
      ) : (
        <ContentReveal>
          <div className="grid gap-4 sm:grid-cols-2">
            <StatCard title={t("avgDaysCustomers")} value={t("dayValue", { days: avgCollect })} icon={TrendingDown} changeType={avgCollect <= 30 ? "positive" : "negative"} />
            <StatCard title={t("avgDaysSuppliers")} value={t("dayValue", { days: avgPay })} icon={TrendingUp} changeType={avgPay <= 30 ? "positive" : "neutral"} />
          </div>

          {receivables.length > 0 && (
            <div className="mt-4">
              <PerformanceTable
                title={t("customersPayYou")}
                entries={receivables}
                countLabel={t("invoices")}
                totalLabel={t("collected")}
                getCount={(e) => e.invoiceCount || 0}
                getTotal={(e) => e.totalCollectedMinor ?? "0"}
                currencyCode={currencyCode}
              />
            </div>
          )}
          {payables.length > 0 && (
            <div className="mt-4">
              <PerformanceTable
                title={t("youPaySuppliers")}
                entries={payables}
                countLabel={t("bills")}
                totalLabel={t("paid")}
                getCount={(e) => e.billCount || 0}
                getTotal={(e) => e.totalPaidMinor ?? "0"}
                currencyCode={currencyCode}
              />
            </div>
          )}
          {receivables.length === 0 && payables.length === 0 && (
            <div className="rounded-xl border border-dashed py-12 text-center mt-4">
              <p className="text-sm text-muted-foreground">{t("noPerfData")}</p>
            </div>
          )}
        </ContentReveal>
      )}
    </ContentReveal>
  );
}

function PerformanceTable({
  title,
  entries,
  countLabel,
  totalLabel,
  getCount,
  getTotal,
  currencyCode,
}: {
  title: string;
  entries: PerformanceEntry[];
  countLabel: string;
  totalLabel: string;
  getCount: (e: PerformanceEntry) => number;
  getTotal: (e: PerformanceEntry) => string;
  currencyCode: string;
}) {
  const presentation = usePresentation();
  const t = useTranslations("AgingVendorReports");
  return (
    <div>
      <p className="text-sm font-medium mb-3">{title}</p>
      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/30">
              <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">{t("contact")}</th>
              <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">{t("avgDays")}</th>
              <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">{t("terms")}</th>
              <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">{countLabel}</th>
              <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">{totalLabel}</th>
              <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">{t("late")}</th>
              <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">{t("onTime")}</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => {
              const overTerms = e.avgDays > e.avgTermDays;
              return (
                <tr key={e.contactId} className="border-b last:border-b-0">
                  <td className="px-4 py-2.5 font-medium">{e.contactName}</td>
                  <td className={cn("px-4 py-2.5 text-right font-mono tabular-nums font-medium", overTerms ? "text-red-600" : "text-emerald-600")}>
                    {t("dayValue", { days: e.avgDays })}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums text-muted-foreground">{t("dayValue", { days: e.avgTermDays })}</td>
                  <td className="px-4 py-2.5 text-right text-muted-foreground">{getCount(e)}</td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums">{currencyLabel(currencyCode, presentation.locale)} {formatExactDecimal(toMajorDecimal(money(BigInt(getTotal(e)), currencyCode)), presentation, false)}</td>
                  <td className="px-4 py-2.5 text-right text-red-600">{e.lateCount > 0 ? e.lateCount : "-"}</td>
                  <td className={cn("px-4 py-2.5 text-right font-mono tabular-nums", e.onTimeRate >= 80 ? "text-emerald-600" : "text-red-600")}>
                    {e.onTimeRate}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
