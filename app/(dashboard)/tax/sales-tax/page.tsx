"use client";

import { useState, useEffect } from "react";
import { MapPin, Receipt, FileText, Printer, ArrowUpRight } from "lucide-react";
import { DateRangeFilter } from "@/components/dashboard/date-range-filter";
import { ExportButton } from "@/components/dashboard/export-button";
import { PageHeader } from "@/components/dashboard/page-header";
import { BrandLoader } from "@/components/dashboard/brand-loader";
import { ContentReveal } from "@/components/ui/content-reveal";
import { Button } from "@/components/ui/button";
import { taxUiMinor, taxUiCurrency, taxUiRows, taxUiMoney, taxUiMax, taxUiPercent } from "@/lib/money/tax-ui";
import { useDocumentTitle } from "@/lib/hooks/use-document-title";
import Link from "next/link";

interface TaxBreakdown {
  taxRateName: string | null;
  taxRatePercent: number | null;
  taxableAmount: bigint;
  taxCollected: bigint;
  invoiceCount: number;
}

export default function SalesTaxPage() {
  const orgId = typeof window !== "undefined" ? localStorage.getItem("activeOrgId") : null;
  return <SalesTaxPageWorkspace key={orgId} orgId={orgId} />;
}

function SalesTaxPageWorkspace({ orgId }: { orgId: string | null }) {
  const now = new Date();
  const [startDate, setStartDate] = useState(`${now.getFullYear()}-01-01`);
  const [endDate, setEndDate] = useState(now.toISOString().slice(0, 10));
  const [breakdown, setBreakdown] = useState<TaxBreakdown[]>([]);
  const [exemptAmount, setExemptAmount] = useState(0n);
  const [loading, setLoading] = useState(true);
  const [currency, setCurrency] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useDocumentTitle("Tax · Sales Tax");

  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams({ startDate, endDate });
    fetch(`/api/v1/reports/sales-tax?${params}`, {
      headers: { "x-organization-id": orgId },
    })
      .then((r) => { if (!r.ok) throw new Error("Could not load tax report"); return r.json(); })
      .then((data) => {
        if (cancelled) return;
        const code = taxUiCurrency(data.currencyCode);
        const rows = taxUiRows(data.breakdown as (Omit<TaxBreakdown, "taxableAmount" | "taxCollected"> & { taxableAmount: number; taxCollected: number })[], ["taxableAmount", "taxCollected"]);
        const exempt = taxUiMinor(data.exemptAmount, data.exemptAmountMinor);
        setBreakdown(rows);
        setCurrency(code); setError(null);
        setExemptAmount(exempt);
      })
      .catch((err) => { if (!cancelled) { setError(err instanceof Error ? err.message : "Invalid tax report"); setCurrency(null); } })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, [startDate, endDate, orgId]);

  const totalTaxable = breakdown.reduce((sum, b) => sum + b.taxableAmount, 0n);
  const totalCollected = breakdown.reduce((sum, b) => sum + b.taxCollected, 0n);
  const totalInvoices = breakdown.reduce((sum, b) => sum + b.invoiceCount, 0);
  const maxTaxable = taxUiMax(totalTaxable, exemptAmount);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sales Tax Report"
        description="Tax collected by rate for the selected period."
      >
        <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => window.print()}>
          <Printer className="size-3.5" />
          Print
        </Button>
        <ExportButton
          data={(error || loading || !currency ? [] : breakdown).map((b) => ({
            taxRate: b.taxRateName || "Exempt",
            ratePercent: b.taxRatePercent != null ? (b.taxRatePercent / 100).toFixed(2) : "",
            taxableAmount: b.taxableAmount.toString(), currencyCode: currency,
            taxCollected: b.taxCollected.toString(),
            invoiceCount: b.invoiceCount,
          }))}
          columns={["taxRate", "ratePercent", "taxableAmount", "taxCollected", "invoiceCount", "currencyCode"]}
          filename="sales-tax"
        />
        <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" asChild>
          <Link href="/tax/periods">
            <ArrowUpRight className="size-3.5" />
            Tax Periods
          </Link>
        </Button>
      </PageHeader>

      <DateRangeFilter
        startDate={startDate}
        endDate={endDate}
        onDateChange={(s, e) => { setStartDate(s); setEndDate(e); }}
      />

      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : loading || !currency ? (
        <BrandLoader className="h-48" />
      ) : (
        <ContentReveal className="space-y-6">
          {/* Summary KPIs */}
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-blue-200 bg-blue-50/60 dark:border-blue-800 dark:bg-blue-950/30 p-4">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-medium uppercase tracking-wide text-blue-700/70 dark:text-blue-400/70">Tax Collected</p>
                <Receipt className="size-4 text-blue-500/50" />
              </div>
              <p className="mt-1 break-all text-xl font-bold font-mono tabular-nums text-blue-700 dark:text-blue-300">
                {taxUiMoney(totalCollected, currency!)}
              </p>
              <p className="text-[11px] text-blue-600/60 dark:text-blue-400/60 mt-0.5">
                {totalInvoices} invoice{totalInvoices !== 1 ? "s" : ""}
              </p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Taxable Sales</p>
                <FileText className="size-4 text-muted-foreground/50" />
              </div>
              <p className="mt-1 break-all text-xl font-bold font-mono tabular-nums">
                {taxUiMoney(totalTaxable, currency!)}
              </p>
              <div className="mt-2 h-1.5 rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-blue-500 transition-all"
                  style={{ width: `${taxUiPercent(totalTaxable, maxTaxable)}%` }}
                />
              </div>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Exempt Sales</p>
                <MapPin className="size-4 text-muted-foreground/50" />
              </div>
              <p className="mt-1 break-all text-xl font-bold font-mono tabular-nums">
                {taxUiMoney(exemptAmount, currency!)}
              </p>
              <div className="mt-2 h-1.5 rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-gray-400 transition-all"
                  style={{ width: `${taxUiPercent(exemptAmount, maxTaxable)}%` }}
                />
              </div>
            </div>
          </div>

          {/* Tax rate breakdown */}
          <div>
            <h3 className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground mb-2">
              Breakdown by Rate
            </h3>
            <div className="space-y-3">
              {breakdown.map((b, i) => {
                const pct = taxUiPercent(b.taxCollected, totalCollected);
                return (
                  <div key={i} className="rounded-lg border bg-card p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="flex size-9 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-950/40">
                          <Receipt className="size-4 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">{b.taxRateName || "No tax rate"}</p>
                          <p className="text-xs text-muted-foreground">
                            {b.taxRatePercent != null ? `${(b.taxRatePercent / 100).toFixed(2)}%` : "N/A"}
                            {" · "}{b.invoiceCount} invoice{b.invoiceCount !== 1 ? "s" : ""}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold font-mono tabular-nums text-blue-600 dark:text-blue-400">
                          {taxUiMoney(b.taxCollected, currency!)}
                        </p>
                        <p className="text-xs text-muted-foreground font-mono tabular-nums">
                          on {taxUiMoney(b.taxableAmount, currency!)}
                        </p>
                      </div>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-blue-500 transition-all"
                        style={{ width: `${Math.max(pct, 1)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Total */}
          <div className="rounded-lg border-2 border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/20 px-5 py-3.5">
            <div className="flex justify-between items-center">
              <span className="text-sm font-semibold">Total Tax Collected</span>
              <span className="font-mono text-base tabular-nums font-bold text-blue-600 dark:text-blue-400">{taxUiMoney(totalCollected, currency!)}</span>
            </div>
          </div>
        </ContentReveal>
      )}
    </div>
  );
}
