"use client";

import { BidiText, IdentifierText } from "@/components/ui/bidi-text";

import { usePresentation } from "@/i18n/provider";
import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
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
  const presentation = usePresentation();
  const t = useTranslations("TaxReports");
  const [dates] = useState(initialDates);
  const [initialLoad, setInitialLoad] = useState(true);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(dates.start);
  const [endDate, setEndDate] = useState(dates.end);
  const [data, setData] = useState<TaxSummaryUi | null>(null);
  const [error, setError] = useState(false);
  const { rates = [], totalOutputTax = 0n, totalInputTax = 0n, netTaxPayable = 0n } = data ?? {};

  useEffect(() => {
    const orgId = localStorage.getItem("activeOrgId");
    if (!orgId) return;
    let cancelled = false;
    setLoading(true);
    setData(null);
    setError(false);
    const params = new URLSearchParams({ startDate, endDate });
    fetch(`/api/v1/reports/tax-summary?${params}`, {
      headers: { "x-organization-id": orgId },
    })
      .then((r) => reportResultJson(r, taxSummaryUi))
      .then((data) => {
        if (cancelled) return;
        setData(data);
      })
      .catch(() => { if (!cancelled) { setData(null); setError(true); } })
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
        title={t("summaryTitle")}
        description={t("summaryDescription")}
      >
        <Button asChild variant="outline" size="sm">
          <a href="/reports/vat-return">{t("openReturn")}</a>
        </Button>
      </PageHeader>

      <ReportHelp>{t("summaryHelp")}</ReportHelp>

      <DateRangeFilter
        startDate={startDate}
        endDate={endDate}
        onDateChange={(s, e) => { setStartDate(s); setEndDate(e); }}
      />

      {error && <p role="alert" className="text-sm text-destructive">{t("loadFailed")}</p>}
      {loading ? (
        <BrandLoader className="h-48" />
      ) : !data ? null : (
        <ContentReveal>
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-3">
              <StatCard
                title={t("outputTax")}
                value={reportResultMoney(totalOutputTax, data.currencyCode, presentation)}
                icon={ArrowUpRight}
                changeType="neutral"
              />
              <StatCard
                title={t("inputTax")}
                value={reportResultMoney(totalInputTax, data.currencyCode, presentation)}
                icon={ArrowDownLeft}
                changeType="neutral"
              />
              <StatCard
                title={netTaxPayable >= 0 ? t("oweOffice") : t("refundOffice")}
                value={reportResultMoney(taxUiAbs(netTaxPayable), data.currencyCode, presentation)}
                icon={Receipt}
                changeType={netTaxPayable > 0 ? "negative" : "positive"}
              />
            </div>

            {rates.length === 0 ? (
              <div className="rounded-xl border border-dashed py-12 text-center">
                <p className="text-sm text-muted-foreground">{t("noActivity")}</p>
              </div>
            ) : (
              <div className="rounded-lg border overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-start px-4 py-2.5 text-xs font-medium text-muted-foreground">{t("taxRate")}</th>
                      <th className="text-end px-4 py-2.5 text-xs font-medium text-muted-foreground">{t("rate")}</th>
                      <th className="text-end px-4 py-2.5 text-xs font-medium text-muted-foreground">{t("salesBeforeTax")}</th>
                      <th className="text-end px-4 py-2.5 text-xs font-medium text-muted-foreground">{t("taxCharged")}</th>
                      <th className="text-end px-4 py-2.5 text-xs font-medium text-muted-foreground">{t("purchasesBeforeTax")}</th>
                      <th className="text-end px-4 py-2.5 text-xs font-medium text-muted-foreground">{t("taxPaid")}</th>
                      <th className="text-end px-4 py-2.5 text-xs font-medium text-muted-foreground">{t("oweRefund")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rates.map((r) => (
                      <tr key={r.taxRateId} className="border-b last:border-b-0">
                        <td className="px-4 py-2.5 font-medium"><BidiText>{r.taxRateName}</BidiText></td>
                        <td className="px-4 py-2.5 text-end font-mono tabular-nums text-muted-foreground"><IdentifierText>
                          {(r.rate / 100).toFixed(2)}%
                        </IdentifierText></td>
                        <td className="px-4 py-2.5 text-end font-mono tabular-nums"><IdentifierText>{reportResultMoney(r.outputNet, data.currencyCode, presentation)}</IdentifierText></td>
                        <td className="px-4 py-2.5 text-end font-mono tabular-nums text-blue-600"><IdentifierText>{reportResultMoney(r.outputTax, data.currencyCode, presentation)}</IdentifierText></td>
                        <td className="px-4 py-2.5 text-end font-mono tabular-nums"><IdentifierText>{reportResultMoney(r.inputNet, data.currencyCode, presentation)}</IdentifierText></td>
                        <td className="px-4 py-2.5 text-end font-mono tabular-nums text-orange-600"><IdentifierText>{reportResultMoney(r.inputTax, data.currencyCode, presentation)}</IdentifierText></td>
                        <td className={cn(
                          "px-4 py-2.5 text-end font-mono tabular-nums font-medium",
                          r.netTax >= 0 ? "text-red-600" : "text-emerald-600"
                        )}>
                          {t.rich(r.netTax < 0 ? "refundAmount" : "dueAmount", { amount: reportResultMoney(taxUiAbs(r.netTax), data.currencyCode, presentation), code: (chunks) => <IdentifierText>{chunks}</IdentifierText> })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t bg-muted/30">
                      <td className="px-4 py-2.5 font-semibold" colSpan={3}>{t("total")}</td>
                      <td className="px-4 py-2.5 text-end font-mono tabular-nums font-semibold text-blue-600"><IdentifierText>{reportResultMoney(totalOutputTax, data.currencyCode, presentation)}</IdentifierText></td>
                      <td className="px-4 py-2.5 text-end font-mono tabular-nums font-semibold" />
                      <td className="px-4 py-2.5 text-end font-mono tabular-nums font-semibold text-orange-600"><IdentifierText>{reportResultMoney(totalInputTax, data.currencyCode, presentation)}</IdentifierText></td>
                      <td className={cn(
                        "px-4 py-2.5 text-end font-mono tabular-nums font-semibold",
                        netTaxPayable >= 0 ? "text-red-600" : "text-emerald-600"
                      )}>
                        {t.rich(netTaxPayable < 0 ? "refundAmount" : "dueAmount", { amount: reportResultMoney(taxUiAbs(netTaxPayable), data.currencyCode, presentation), code: (chunks) => <IdentifierText>{chunks}</IdentifierText> })}
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
