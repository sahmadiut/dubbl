"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { ArrowLeft, TrendingUp, TrendingDown } from "lucide-react";
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

interface PerformanceEntry {
  contactId: string;
  contactName: string;
  avgDays: number;
  avgTermDays: number;
  invoiceCount?: number;
  billCount?: number;
  totalCollected?: number;
  totalCollectedMinor?: string;
  totalPaid?: number;
  totalPaidMinor?: string;
  lateCount: number;
  onTimeRate: number;
}

export default function PaymentPerformancePage() {
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
  const [error, setError] = useState<string | null>(null);

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
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || "Unable to load payment performance.");
        return data;
      })
      .then((data) => {
        if (cancelled) return;
        setReceivables(data.receivables || []);
        setPayables(data.payables || []);
        setAvgCollect(data.avgDaysToCollect || 0);
        setAvgPay(data.avgDaysToPay || 0);
        setCurrencyCode(data.currencyCode);
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Unable to load payment performance.");
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
      <Link href="/reports" className="flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="size-3.5" /> Back to reports
      </Link>

      <PageHeader title="How fast you get paid" description="Average time customers take to pay you, and you take to pay suppliers.">
        <ExportButton
          data={loading || error ? [] : [...receivables.map((r) => ({ ...r, currencyCode, type: "receivable" })), ...payables.map((p) => ({ ...p, currencyCode, type: "payable" }))]}
          columns={["type", "contactName", "currencyCode", "avgDays", "avgTermDays", "invoiceCount", "billCount", "totalCollectedMinor", "totalPaidMinor", "lateCount", "onTimeRate"]}
          filename="payment-performance"
        />
      </PageHeader>

      <DateRangeFilter startDate={startDate} endDate={endDate} onDateChange={(s, e) => { setStartDate(s); setEndDate(e); }} />
      <div className="flex items-center gap-3">
        <span className="text-sm">Document currency</span>
        <CurrencySelect value={currencyFilter} onValueChange={setCurrencyFilter} compact />
        {currencyFilter && <Button variant="ghost" size="sm" onClick={() => setCurrencyFilter("")}>Clear filter</Button>}
      </div>

      {loading ? (
        <BrandLoader className="h-48" />
      ) : error ? (
        <p role="alert" className="text-sm text-red-600">{error}</p>
      ) : (
        <ContentReveal>
          <div className="grid gap-4 sm:grid-cols-2">
            <StatCard title="Average days customers take to pay you" value={`${avgCollect}d`} icon={TrendingDown} changeType={avgCollect <= 30 ? "positive" : "negative"} />
            <StatCard title="Average days you take to pay suppliers" value={`${avgPay}d`} icon={TrendingUp} changeType={avgPay <= 30 ? "positive" : "neutral"} />
          </div>

          {receivables.length > 0 && (
            <div className="mt-4">
              <PerformanceTable
                title="How quickly customers pay you"
                entries={receivables}
                countLabel="Invoices"
                totalLabel="Collected"
                getCount={(e) => e.invoiceCount || 0}
                getTotal={(e) => e.totalCollectedMinor ?? "0"}
                currencyCode={currencyCode}
              />
            </div>
          )}
          {payables.length > 0 && (
            <div className="mt-4">
              <PerformanceTable
                title="How quickly you pay suppliers"
                entries={payables}
                countLabel="Bills"
                totalLabel="Paid"
                getCount={(e) => e.billCount || 0}
                getTotal={(e) => e.totalPaidMinor ?? "0"}
                currencyCode={currencyCode}
              />
            </div>
          )}
          {receivables.length === 0 && payables.length === 0 && (
            <div className="rounded-xl border border-dashed py-12 text-center mt-4">
              <p className="text-sm text-muted-foreground">No payment data for this period. Pay or collect invoices/bills to see performance.</p>
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
  return (
    <div>
      <p className="text-sm font-medium mb-3">{title}</p>
      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/30">
              <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Contact</th>
              <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Avg Days</th>
              <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Terms</th>
              <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">{countLabel}</th>
              <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">{totalLabel}</th>
              <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Late</th>
              <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">On-Time</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => {
              const overTerms = e.avgDays > e.avgTermDays;
              return (
                <tr key={e.contactId} className="border-b last:border-b-0">
                  <td className="px-4 py-2.5 font-medium">{e.contactName}</td>
                  <td className={cn("px-4 py-2.5 text-right font-mono tabular-nums font-medium", overTerms ? "text-red-600" : "text-emerald-600")}>
                    {e.avgDays}d
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums text-muted-foreground">{e.avgTermDays}d</td>
                  <td className="px-4 py-2.5 text-right text-muted-foreground">{getCount(e)}</td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums">{currencyCode} {toMajorDecimal(money(BigInt(getTotal(e)), currencyCode))}</td>
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
