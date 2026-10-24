"use client";

import { usePresentation } from "@/i18n/provider";
import { vendorSpendUi, analyticalReportJson } from "@/lib/money/analytical-report-ui";
import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { TrendingDown } from "lucide-react";
import { BrandLoader } from "@/components/dashboard/brand-loader";
import { ContentReveal } from "@/components/ui/content-reveal";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { DateRangeFilter } from "@/components/dashboard/date-range-filter";
import { analyticalMoney as formatMoney } from "@/lib/money/analytical-report-ui";
import { CurrencySelect } from "@/components/ui/currency-select";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ExportButton } from "@/components/dashboard/export-button";
import { BackToReports } from "../_components";

type Vendor = ReturnType<typeof vendorSpendUi>["vendors"][number];

const BAR_COLORS = [
  "bg-red-500", "bg-orange-500", "bg-amber-500", "bg-yellow-500",
  "bg-lime-500", "bg-emerald-500", "bg-teal-500", "bg-cyan-500",
  "bg-blue-500", "bg-violet-500",
];

export default function VendorSpendPage() {
  const presentation = usePresentation();
  const t = useTranslations("AgingVendorReports");
  const now = new Date();
  const [initialLoad, setInitialLoad] = useState(true);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(`${now.getFullYear()}-01-01`);
  const [endDate, setEndDate] = useState(now.toISOString().slice(0, 10));
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [totalSpend, setTotalSpend] = useState(0n);
  const [currencyCode, setCurrencyCode] = useState("USD");
  const [currencyFilter, setCurrencyFilter] = useState("");
  const [error, setError] = useState(false);

  useEffect(() => {
    const orgId = localStorage.getItem("activeOrgId");
    if (!orgId) return;
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams({ startDate, endDate });
    if (currencyFilter) params.set("currencyCode", currencyFilter);
    fetch(`/api/v1/reports/vendor-spend?${params}`, {
      headers: { "x-organization-id": orgId },
    })
      .then((r) => analyticalReportJson(r, vendorSpendUi))
      .then((data) => {
        if (cancelled) return;
        setVendors(data.vendors);
        setCurrencyCode(data.currencyCode);
        setError(false);
        setTotalSpend(data.totalSpend);
      })
      .catch(() => { if (!cancelled) { setVendors([]); setTotalSpend(0n); setError(true); } })
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

      <PageHeader title={t("vendorTitle")} description={t("vendorDescription")}>
        <ExportButton
          data={loading || error ? [] : vendors.map(row => ({ ...row, currencyCode }))}
          columns={["contactName", "currencyCode", "totalSpend", "billCount", "avgBillAmount", "lastBillDate", "percentage"]}
          filename="vendor-spend"
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
      ) : error ? <p role="alert" className="text-sm text-destructive">{t("loadFailed")}</p> : (
        <ContentReveal>
          <div className="grid gap-4 sm:grid-cols-2">
            <StatCard title={t("totalSpentWithSuppliers")} value={formatMoney(totalSpend, currencyCode, presentation)} icon={TrendingDown} changeType="negative" />
            <StatCard title={t("suppliers")} value={String(vendors.length)} icon={TrendingDown} changeType="neutral" change={t("activeCount", { count: vendors.length })} />
          </div>

          {vendors.length === 0 ? (
            <div className="rounded-xl border border-dashed py-12 text-center mt-4">
              <p className="text-sm text-muted-foreground">{t("noVendorData")}</p>
            </div>
          ) : (
            <>
              {/* Stacked bar */}
              <div className="h-3 rounded-full overflow-hidden flex mt-4">
                {vendors.slice(0, 10).map((v, i) => (
                  <div key={v.contactId} className={cn("h-full", BAR_COLORS[i % BAR_COLORS.length])} style={{ width: `${v.percentage}%` }} title={`${v.contactName}: ${v.percentage}%`} />
                ))}
              </div>

              <div className="rounded-lg border overflow-hidden mt-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">{t("vendor")}</th>
                      <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">{t("totalSpend")}</th>
                      <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">{t("bills")}</th>
                      <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">{t("avgBill")}</th>
                      <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">{t("lastBill")}</th>
                      <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">{t("percentage")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vendors.map((v, i) => (
                      <tr key={v.contactId} className="border-b last:border-b-0">
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <div className={cn("size-2.5 rounded-full shrink-0", BAR_COLORS[i % BAR_COLORS.length])} />
                            <span className="font-medium">{v.contactName}</span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono tabular-nums font-medium">{formatMoney(v.totalSpend, currencyCode, presentation)}</td>
                        <td className="px-4 py-2.5 text-right text-muted-foreground">{v.billCount}</td>
                        <td className="px-4 py-2.5 text-right font-mono tabular-nums text-muted-foreground">{formatMoney(v.avgBillAmount, currencyCode, presentation)}</td>
                        <td className="px-4 py-2.5 text-right text-muted-foreground">{new Date(v.lastBillDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</td>
                        <td className="px-4 py-2.5 text-right font-mono tabular-nums text-muted-foreground">{v.percentage}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </ContentReveal>
      )}
    </ContentReveal>
  );
}
