"use client";

import { useState, useEffect } from "react";
import { Receipt, ArrowUpRight, ArrowDownLeft } from "lucide-react";
import { BrandLoader } from "@/components/dashboard/brand-loader";
import { ContentReveal } from "@/components/ui/content-reveal";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { DateRangeFilter } from "@/components/dashboard/date-range-filter";
import { Button } from "@/components/ui/button";
import { reportResultJson, reportResultMoney, taxSummaryUi, type TaxSummaryUi } from "@/lib/money/report-result-ui";
import { taxUiAbs } from "@/lib/money/tax-ui";
import { cn } from "@/lib/utils";
import { BackToReports, ReportHelp } from "../_components";

/** Honor ?startDate/&endDate when arriving from a tax-return drill-down link. */
function initialDates() {
  const now = new Date();
  const fallback = { start: `${now.getFullYear()}-01-01`, end: now.toISOString().slice(0, 10) };
  if (typeof window === "undefined") return fallback;
  const p = new URLSearchParams(window.location.search);
  return {
    start: p.get("startDate") || fallback.start,
    end: p.get("endDate") || fallback.end,
  };
}

export default function TaxSummaryPage() {
  const [dates] = useState(initialDates);
  const [initialLoad, setInitialLoad] = useState(true);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(dates.start);
  const [endDate, setEndDate] = useState(dates.end);
  const [data, setData] = useState<TaxSummaryUi | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { rates = [], totalOutputTax = 0n, totalInputTax = 0n, netTaxPayable = 0n } = data ?? {};

  useEffect(() => {
    const orgId = localStorage.getItem("activeOrgId");
    if (!orgId) return;
    let cancelled = false;
    setLoading(true);
    setData(null);
    setError(null);
    const params = new URLSearchParams({ startDate, endDate });
    fetch(`/api/v1/reports/tax-summary?${params}`, {
      headers: { "x-organization-id": orgId },
    })
      .then((r) => reportResultJson(r, taxSummaryUi))
      .then((data) => {
        if (cancelled) return;
        setData(data);
      })
      .catch((cause: Error) => { if (!cancelled) { setData(null); setError(cause.message); } })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
          setInitialLoad(false);
        }
      });
    return () => { cancelled = true; };
  }, [startDate, endDate]);

  if (initialLoad) return <BrandLoader />;

  return (
    <ContentReveal className="space-y-6">
      <BackToReports />

      <PageHeader
        title="Tax collected vs tax paid"
        description="Tax you charged on sales vs tax you paid on purchases, by tax rate."
      >
        <Button asChild variant="outline" size="sm">
          <a href="/reports/vat-return">Open the full tax return</a>
        </Button>
      </PageHeader>

      <ReportHelp>
        A breakdown by tax rate of the tax you added to customer invoices and the
        tax you paid on supplier bills. The difference is roughly what you&apos;ll pay
        to (or get back from) the tax office.
      </ReportHelp>

      <DateRangeFilter
        startDate={startDate}
        endDate={endDate}
        onDateChange={(s, e) => { setStartDate(s); setEndDate(e); }}
      />

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {loading ? (
        <BrandLoader className="h-48" />
      ) : !data ? null : (
        <ContentReveal>
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-3">
              <StatCard
                title="Tax you charged on sales"
                value={reportResultMoney(totalOutputTax, data.currencyCode)}
                icon={ArrowUpRight}
                changeType="neutral"
              />
              <StatCard
                title="Tax you paid on purchases"
                value={reportResultMoney(totalInputTax, data.currencyCode)}
                icon={ArrowDownLeft}
                changeType="neutral"
              />
              <StatCard
                title={netTaxPayable >= 0 ? "You'll owe the tax office" : "You'll get a refund"}
                value={reportResultMoney(taxUiAbs(netTaxPayable), data.currencyCode)}
                icon={Receipt}
                changeType={netTaxPayable > 0 ? "negative" : "positive"}
              />
            </div>

            {rates.length === 0 ? (
              <div className="rounded-xl border border-dashed py-12 text-center">
                <p className="text-sm text-muted-foreground">No tax activity for this period.</p>
              </div>
            ) : (
              <div className="rounded-lg border overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Tax rate</th>
                      <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Rate</th>
                      <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Sales (before tax)</th>
                      <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Tax charged</th>
                      <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Purchases (before tax)</th>
                      <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Tax paid</th>
                      <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Owe / refund</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rates.map((r) => (
                      <tr key={r.taxRateId} className="border-b last:border-b-0">
                        <td className="px-4 py-2.5 font-medium">{r.taxRateName}</td>
                        <td className="px-4 py-2.5 text-right font-mono tabular-nums text-muted-foreground">
                          {(r.rate / 100).toFixed(2)}%
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono tabular-nums">{reportResultMoney(r.outputNet, data.currencyCode)}</td>
                        <td className="px-4 py-2.5 text-right font-mono tabular-nums text-blue-600">{reportResultMoney(r.outputTax, data.currencyCode)}</td>
                        <td className="px-4 py-2.5 text-right font-mono tabular-nums">{reportResultMoney(r.inputNet, data.currencyCode)}</td>
                        <td className="px-4 py-2.5 text-right font-mono tabular-nums text-orange-600">{reportResultMoney(r.inputTax, data.currencyCode)}</td>
                        <td className={cn(
                          "px-4 py-2.5 text-right font-mono tabular-nums font-medium",
                          r.netTax >= 0 ? "text-red-600" : "text-emerald-600"
                        )}>
                          {reportResultMoney(taxUiAbs(r.netTax), data.currencyCode)}
                          {r.netTax < 0 ? " refund" : " due"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t bg-muted/30">
                      <td className="px-4 py-2.5 font-semibold" colSpan={3}>Total</td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums font-semibold text-blue-600">{reportResultMoney(totalOutputTax, data.currencyCode)}</td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums font-semibold" />
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums font-semibold text-orange-600">{reportResultMoney(totalInputTax, data.currencyCode)}</td>
                      <td className={cn(
                        "px-4 py-2.5 text-right font-mono tabular-nums font-semibold",
                        netTaxPayable >= 0 ? "text-red-600" : "text-emerald-600"
                      )}>
                        {reportResultMoney(taxUiAbs(netTaxPayable), data.currencyCode)}
                        {netTaxPayable < 0 ? " refund" : " due"}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </ContentReveal>
      )}
    </ContentReveal>
  );
}
