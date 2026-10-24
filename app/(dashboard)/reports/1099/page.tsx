"use client";

import { usePresentation } from "@/i18n/provider";
import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { FileText, AlertTriangle } from "lucide-react";
import { BrandLoader } from "@/components/dashboard/brand-loader";
import { ContentReveal } from "@/components/ui/content-reveal";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ExportButton } from "@/components/dashboard/export-button";
import { reportResultJson, reportResultMoney, report1099Ui, type Report1099Ui } from "@/lib/money/report-result-ui";
import { cn } from "@/lib/utils";
import { BackToReports, ReportHelp } from "../_components";

type Report1099 = Report1099Ui;

export default function Form1099Page() {
  const presentation = usePresentation();
  const t = useTranslations("TaxReports");
  const now = new Date();
  const [error, setError] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(now.getFullYear() - 1);
  const [data, setData] = useState<Report1099 | null>(null);

  useEffect(() => {
    const orgId = localStorage.getItem("activeOrgId");
    if (!orgId) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(false);
    setData(null);
    fetch(`/api/v1/reports/1099?year=${year}`, {
      headers: { "x-organization-id": orgId },
    })
      .then((r) => reportResultJson(r, report1099Ui))
      .then((d) => {
        if (cancelled) return;
        setData(d);
      })
      .catch(() => { if (!cancelled) { setData(null); setError(true); } })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
          setInitialLoad(false);
        }
      });
    return () => { cancelled = true; };
  }, [year]);

  if (initialLoad) return <BrandLoader />;

  const years = [now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2, now.getFullYear() - 3];

  return (
    <ContentReveal className="space-y-6">
      <BackToReports />

      <PageHeader
        title={t("vendorTitle")}
        description={t("vendorDescription")}
      >
        {data && (
          <ExportButton
            data={data.vendors.map(row => ({ ...row, totalPaid: row.totalPaid.toString(), currencyCode: data.currencyCode }))}
            columns={["name", "taxIdentifier", "totalPaid", "paymentCount", "reportable", "currencyCode"]}
            filename={`1099-${year}`}
          />
        )}
      </PageHeader>

      <ReportHelp>{t("vendorHelp")}</ReportHelp>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[13px] text-muted-foreground">{t("taxYear")}</span>
        {years.map((y) => (
          <Button
            key={y}
            variant={year === y ? "default" : "outline"}
            size="sm"
            onClick={() => setYear(y)}
            className={year === y ? "bg-emerald-600 hover:bg-emerald-700" : ""}
          >
            {y}
          </Button>
        ))}
      </div>

      {error && <p role="alert" className="text-sm text-destructive">{t("loadFailed")}</p>}

      {loading ? (
        <BrandLoader className="h-48" />
      ) : error ? null : !data || data.vendors.length === 0 ? (
        <ContentReveal>
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 px-6 text-center">
            <div className="flex size-12 items-center justify-center rounded-lg bg-muted">
              <FileText className="size-6 text-muted-foreground" />
            </div>
            <h3 className="mt-4 text-sm font-semibold">{t("noContractors")}</h3>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              {t("noContractorsHelp", { year: String(year) })}
            </p>
          </div>
        </ContentReveal>
      ) : (
        <ContentReveal>
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border bg-card/80 p-4">
                <p className="text-xs text-muted-foreground">{t("needForm")}</p>
                <p className="mt-1 text-xl font-bold">{data.reportableCount}</p>
                <p className="text-xs text-muted-foreground">{t("aboveThreshold")}</p>
              </div>
              <div className="rounded-xl border bg-card/80 p-4">
                <p className="text-xs text-muted-foreground">{t("reportableTotal")}</p>
                <p className="mt-1 text-xl font-bold font-mono tabular-nums">{reportResultMoney(data.reportableTotal, data.currencyCode, presentation)}</p>
              </div>
              <div className="rounded-xl border bg-card/80 p-4">
                <p className="text-xs text-muted-foreground">{t("threshold")}</p>
                <p className="mt-1 text-xl font-bold font-mono tabular-nums">{reportResultMoney(data.threshold, data.currencyCode, presentation)}</p>
              </div>
            </div>

            <div className="rounded-lg border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>{t("contractor")}</TableHead>
                    <TableHead>{t("taxId")}</TableHead>
                    <TableHead className="text-right w-24">{t("payments")}</TableHead>
                    <TableHead className="text-right w-32">{t("totalPaid")}</TableHead>
                    <TableHead className="w-36">{t("needsForm")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.vendors.map((v) => (
                    <TableRow key={v.contactId}>
                      <TableCell className="font-medium">
                        {v.name}
                        {v.backupWithholding && (
                          <span className="ml-2 inline-flex items-center gap-1 text-xs text-amber-600">
                            <AlertTriangle className="size-3" /> {t("backupWithholding")}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-sm text-muted-foreground">
                        {v.taxIdentifier || <span className="text-amber-600">{t("missing")}</span>}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">{v.paymentCount}</TableCell>
                      <TableCell className="text-right font-mono tabular-nums">{reportResultMoney(v.totalPaid, data.currencyCode, presentation)}</TableCell>
                      <TableCell>
                        <span className={cn(
                          "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                          v.reportable
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                            : "bg-muted text-muted-foreground"
                        )}>
                          {v.reportable ? t("fileForm") : t("belowThreshold")}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </ContentReveal>
      )}
    </ContentReveal>
  );
}
