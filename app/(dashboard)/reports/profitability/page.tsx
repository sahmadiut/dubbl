"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { ArrowLeft, TrendingUp, TrendingDown, DollarSign } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { DateRangeFilter } from "@/components/dashboard/date-range-filter";
import { BrandLoader } from "@/components/dashboard/brand-loader";
import { ContentReveal } from "@/components/ui/content-reveal";
import { statementMoneyText } from "@/lib/reports/statement-money";
import { CurrencySelect } from "@/components/ui/currency-select";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ProfitabilityEntry {
  contactId: string;
  contactName: string;
  revenue: number;
  costs: number;
  profit: number;
  margin: number;
  invoiceCount: number;
  billCount: number;
}

export default function ProfitabilityPage() {
  const now = new Date();
  const [initialLoad, setInitialLoad] = useState(true);
  const [loading, setLoading] = useState(true);
  const [currencyCode, setCurrencyCode] = useState("USD");
  const [error, setError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState(`${now.getFullYear()}-01-01`);
  const [endDate, setEndDate] = useState(now.toISOString().slice(0, 10));
  const [currencyFilter, setCurrencyFilter] = useState("");
  const [entries, setEntries] = useState<ProfitabilityEntry[]>([]);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalCosts, setTotalCosts] = useState(0);
  const [totalProfit, setTotalProfit] = useState(0);
  const [overallMargin, setOverallMargin] = useState(0);

  useEffect(() => {
    const orgId = localStorage.getItem("activeOrgId");
    if (!orgId) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    const params = new URLSearchParams({ startDate, endDate, groupBy: "contact" });
    if (currencyFilter) params.set("currencyCode", currencyFilter);
    fetch(`/api/v1/reports/profitability?${params}`, {
      headers: { "x-organization-id": orgId },
    })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || "Unable to load profitability.");
        return data;
      })
      .then((data) => {
        if (cancelled) return;
        setCurrencyCode(data.currencyCode);
        setError(null);
        setEntries(data.entries || []);
        setTotalRevenue(data.totalRevenue || 0);
        setTotalCosts(data.totalCosts || 0);
        setTotalProfit(data.totalProfit || 0);
        setOverallMargin(data.overallMargin || 0);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Unable to load profitability.");
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
      <Link href="/reports" className="flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="size-3.5" /> Back to reports
      </Link>

      <PageHeader
        title="Profit by customer"
        description="What each customer brought in, minus what serving them cost, for the period."
      />

      <DateRangeFilter
        startDate={startDate}
        endDate={endDate}
        onDateChange={(s, e) => { setStartDate(s); setEndDate(e); }}
      />

      <div className="flex items-center gap-3">
        <span className="text-sm">Document currency</span>
        <CurrencySelect value={currencyFilter} onValueChange={setCurrencyFilter} compact />
        {currencyFilter && <Button variant="ghost" size="sm" onClick={() => setCurrencyFilter("")}>Clear filter</Button>}
      </div>

      {!loading && !error && <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Money in"
          value={statementMoneyText(totalRevenue, currencyCode)}
          icon={TrendingUp}
          changeType="positive"
        />
        <StatCard
          title="Costs"
          value={statementMoneyText(totalCosts, currencyCode)}
          icon={TrendingDown}
          changeType="negative"
        />
        <StatCard
          title="Profit"
          value={statementMoneyText(totalProfit, currencyCode)}
          icon={DollarSign}
          changeType={totalProfit >= 0 ? "positive" : "negative"}
        />
        <StatCard
          title="Overall Margin"
          value={`${overallMargin}%`}
          icon={DollarSign}
          changeType={overallMargin > 0 ? "positive" : "negative"}
        />
      </div>}

      {loading ? (
        <BrandLoader className="h-48" />
      ) : error ? (
        <p role="alert" className="text-sm text-red-600">{error}</p>
      ) : entries.length === 0 ? (
        <ContentReveal>
          <div className="rounded-xl border border-dashed py-12 text-center">
            <p className="text-sm text-muted-foreground">No profitability data. Create invoices and bills to see per-contact profitability.</p>
          </div>
        </ContentReveal>
      ) : error ? (
        <p role="alert" className="text-sm text-red-600">{error}</p>
      ) : (
        <ContentReveal>
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Contact</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Revenue</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Costs</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Profit</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Margin</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Invoices</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Bills</th>
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
                  <td className="px-4 py-2.5 font-semibold">Total</td>
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
