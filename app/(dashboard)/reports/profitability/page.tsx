"use client";

import { profitabilityUi, analyticalReportJson } from "@/lib/money/analytical-report-ui";
import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { BackToReports } from "../_components";
import { TrendingUp, TrendingDown, DollarSign } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { DateRangeFilter } from "@/components/dashboard/date-range-filter";
import { BrandLoader } from "@/components/dashboard/brand-loader";
import { ContentReveal } from "@/components/ui/content-reveal";
import { analyticalMoney as statementMoneyText } from "@/lib/money/analytical-report-ui";
import { CurrencySelect } from "@/components/ui/currency-select";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ProfitabilityEntry = ReturnType<typeof profitabilityUi>["entries"][number];

export default function ProfitabilityPage() {
  const t = useTranslations("AnalyticalReports");
  const now = new Date();
  const [initialLoad, setInitialLoad] = useState(true);
  const [loading, setLoading] = useState(true);
  const [currencyCode, setCurrencyCode] = useState("USD");
  const [error, setError] = useState(false);
  const [startDate, setStartDate] = useState(`${now.getFullYear()}-01-01`);
  const [endDate, setEndDate] = useState(now.toISOString().slice(0, 10));
  const [currencyFilter, setCurrencyFilter] = useState("");
  const [entries, setEntries] = useState<ProfitabilityEntry[]>([]);
  const [totalRevenue, setTotalRevenue] = useState(0n);
  const [totalCosts, setTotalCosts] = useState(0n);
  const [totalProfit, setTotalProfit] = useState(0n);
  const [overallMargin, setOverallMargin] = useState(0);

  useEffect(() => {
    const orgId = localStorage.getItem("activeOrgId");
    if (!orgId) return;
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams({ startDate, endDate, groupBy: "contact" });
    if (currencyFilter) params.set("currencyCode", currencyFilter);
    fetch(`/api/v1/reports/profitability?${params}`, {
      headers: { "x-organization-id": orgId },
    })
      .then((r) => analyticalReportJson(r, profitabilityUi))
      .then((data) => {
        if (cancelled) return;
        setCurrencyCode(data.currencyCode);
        setError(false);
        setEntries(data.entries || []);
        setTotalRevenue(data.totalRevenue);
        setTotalCosts(data.totalCosts);
        setTotalProfit(data.totalProfit);
        setOverallMargin(data.overallMargin || 0);
      })
      .catch(() => {
        if (!cancelled) { setEntries([]); setTotalRevenue(0n); setTotalCosts(0n); setTotalProfit(0n); setError(true); }
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

      <PageHeader
        title={t("profitTitle")}
        description={t("profitDescription")}
      />

      <DateRangeFilter
        startDate={startDate}
        endDate={endDate}
        onDateChange={(s, e) => { setStartDate(s); setEndDate(e); }}
      />

      <div className="flex items-center gap-3">
        <span className="text-sm">{t("documentCurrency")}</span>
        <CurrencySelect value={currencyFilter} onValueChange={setCurrencyFilter} compact />
        {currencyFilter && <Button variant="ghost" size="sm" onClick={() => setCurrencyFilter("")}>{t("clearFilter")}</Button>}
      </div>

      {!loading && !error && <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title={t("moneyIn")}
          value={statementMoneyText(totalRevenue, currencyCode)}
          icon={TrendingUp}
          changeType="positive"
        />
        <StatCard
          title={t("costs")}
          value={statementMoneyText(totalCosts, currencyCode)}
          icon={TrendingDown}
          changeType="negative"
        />
        <StatCard
          title={t("profit")}
          value={statementMoneyText(totalProfit, currencyCode)}
          icon={DollarSign}
          changeType={totalProfit >= 0 ? "positive" : "negative"}
        />
        <StatCard
          title={t("overallMargin")}
          value={`${overallMargin}%`}
          icon={DollarSign}
          changeType={overallMargin > 0 ? "positive" : "negative"}
        />
      </div>}

      {loading ? (
        <BrandLoader className="h-48" />
      ) : error ? (
        <p role="alert" className="text-sm text-red-600">{t("loadFailed")}</p>
      ) : entries.length === 0 ? (
        <ContentReveal>
          <div className="rounded-xl border border-dashed py-12 text-center">
            <p className="text-sm text-muted-foreground">{t("noProfitData")}</p>
          </div>
        </ContentReveal>
      ) : error ? (
        <p role="alert" className="text-sm text-red-600">{t("loadFailed")}</p>
      ) : (
        <ContentReveal>
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">{t("contact")}</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">{t("revenue")}</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">{t("costs")}</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">{t("profit")}</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">{t("margin")}</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">{t("invoices")}</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">{t("bills")}</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.contactId} className="border-b last:border-b-0">
                    <td className="px-4 py-2.5 font-medium">{e.contactName}</td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums text-emerald-600">{statementMoneyText(e.revenue, currencyCode)}</td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums text-red-600">{statementMoneyText(e.costs, currencyCode)}</td>
                    <td className={cn(
                      "px-4 py-2.5 text-right font-mono tabular-nums font-medium",
                      e.profit >= 0 ? "text-emerald-600" : "text-red-600"
                    )}>
                      {statementMoneyText(e.profit, currencyCode)}
                    </td>
                    <td className={cn(
                      "px-4 py-2.5 text-right font-mono tabular-nums",
                      e.margin >= 0 ? "text-emerald-600" : "text-red-600"
                    )}>
                      {e.margin}%
                    </td>
                    <td className="px-4 py-2.5 text-right text-muted-foreground">{e.invoiceCount}</td>
                    <td className="px-4 py-2.5 text-right text-muted-foreground">{e.billCount}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t bg-muted/30">
                  <td className="px-4 py-2.5 font-semibold">{t("total")}</td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums font-semibold text-emerald-600">{statementMoneyText(totalRevenue, currencyCode)}</td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums font-semibold text-red-600">{statementMoneyText(totalCosts, currencyCode)}</td>
                  <td className={cn(
                    "px-4 py-2.5 text-right font-mono tabular-nums font-semibold",
                    totalProfit >= 0 ? "text-emerald-600" : "text-red-600"
                  )}>
                    {statementMoneyText(totalProfit, currencyCode)}
                  </td>
                  <td className={cn(
                    "px-4 py-2.5 text-right font-mono tabular-nums font-semibold",
                    overallMargin >= 0 ? "text-emerald-600" : "text-red-600"
                  )}>
                    {overallMargin}%
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        </ContentReveal>
      )}
    </ContentReveal>
  );
}
