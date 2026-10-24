"use client";

import { usePresentation } from "@/i18n/provider";
import Link from "next/link";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Layers } from "lucide-react";
import { BrandLoader } from "@/components/dashboard/brand-loader";
import { ContentReveal } from "@/components/ui/content-reveal";
import { PageHeader } from "@/components/dashboard/page-header";
import { DateRangeFilter } from "@/components/dashboard/date-range-filter";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { reportResultJson, reportResultMoney, trackingReportUi, type TrackingReportUi } from "@/lib/money/report-result-ui";
import { BackToReports, ReportHelp, BasisToggle } from "../_components";

type TrackingResponse = TrackingReportUi;
type ColumnDesc = TrackingReportUi["columns"][number];
type SectionData = TrackingReportUi["sections"][number];

type Dimension = "costCenterId" | "projectId";

export default function TrackingReportPage() {
  const presentation = usePresentation();
  const t = useTranslations("AnalyticalReports");
  const now = new Date();
  const [error, setError] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(`${now.getFullYear()}-01-01`);
  const [endDate, setEndDate] = useState(now.toISOString().slice(0, 10));
  const [basis, setBasis] = useState<"accrual" | "cash">("accrual");
  const [dimension, setDimension] = useState<Dimension>("costCenterId");
  const [data, setData] = useState<TrackingResponse | null>(null);

  useEffect(() => {
    const orgId = localStorage.getItem("activeOrgId");
    if (!orgId) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(false);
    setData(null);
    const params = new URLSearchParams({ startDate, endDate, basis, dimension, mode: "pnl" });
    fetch(`/api/v1/reports/tracking-category?${params}`, {
      headers: { "x-organization-id": orgId },
    })
      .then((r) => reportResultJson(r, trackingReportUi))
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
  }, [startDate, endDate, basis, dimension]);

  if (initialLoad) return <BrandLoader />;

  const columns = data?.columns ?? [];
  const dimQueryKey = dimension === "projectId" ? "projectId" : "costCenterId";

  /** Drill-down: open the full transaction list for this account + column. */
  function ledgerHref(accountId: string, col: ColumnDesc): string {
    const params = new URLSearchParams({ startDate, endDate });
    params.set(dimQueryKey, col.dimensionValue ?? "none");
    return `/reports/general-ledger?${params.toString()}#${accountId}`;
  }

  return (
    <ContentReveal className="space-y-6">
      <BackToReports />

      <PageHeader
        title={t("trackingTitle")}
        description={t("trackingDescription")}
      >
        <a
          href={`/api/v1/reports/tracking-category?${new URLSearchParams({ startDate, endDate, basis, dimension, mode: "pnl", format: "xlsx" })}`}
          className="inline-flex h-8 items-center rounded-md border px-3 text-sm font-medium hover:bg-muted"
        >
          {t("exportSpreadsheet")}
        </a>
      </PageHeader>

      <ReportHelp>{t(dimension === "projectId" ? "trackingProjectHelp" : "trackingDepartmentHelp")}</ReportHelp>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[13px] text-muted-foreground">{t("splitBy")}</span>
          <Button
            variant={dimension === "costCenterId" ? "default" : "outline"}
            size="sm"
            onClick={() => setDimension("costCenterId")}
            className={dimension === "costCenterId" ? "bg-emerald-600 hover:bg-emerald-700" : ""}
          >
            {t("department")}
          </Button>
          <Button
            variant={dimension === "projectId" ? "default" : "outline"}
            size="sm"
            onClick={() => setDimension("projectId")}
            className={dimension === "projectId" ? "bg-emerald-600 hover:bg-emerald-700" : ""}
          >
            {t("project")}
          </Button>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <DateRangeFilter
            startDate={startDate}
            endDate={endDate}
            onDateChange={(s, e) => { setStartDate(s); setEndDate(e); }}
          />
          <BasisToggle basis={basis} onChange={setBasis} />
        </div>
      </div>

      {error && <p role="alert" className="text-sm text-destructive">{t("loadFailed")}</p>}

      {loading ? (
        <BrandLoader className="h-48" />
      ) : error ? null : !data || columns.length === 0 ? (
        <ContentReveal>
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 px-6 text-center">
            <div className="flex size-12 items-center justify-center rounded-lg bg-muted">
              <Layers className="size-6 text-muted-foreground" />
            </div>
            <h3 className="mt-4 text-sm font-semibold">{t("nothingTagged")}</h3>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              {t(dimension === "projectId" ? "noTaggedProject" : "noTaggedDepartment")}
            </p>
          </div>
        </ContentReveal>
      ) : (
        <ContentReveal>
          <div className="rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>{t("account")}</TableHead>
                  {columns.map((c) => (
                    <TableHead key={c.key} className="text-right">{c.dimensionValue === null ? t("unassigned") : c.label}</TableHead>
                  ))}
                  <TableHead className="text-right">{t("total")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.sections.map((section) => (
                  <RenderSection
                    key={section.label}
                    section={section}
                    currencyCode={data.currencyCode}
                    columns={columns}
                    ledgerHref={ledgerHref}
                  />
                ))}
                {data.netIncome && (
                  <TableRow className="bg-emerald-50 dark:bg-emerald-950/30 font-bold">
                    <TableCell>{t("trackingProfit")}</TableCell>
                    {data.netIncome.byColumn.map((amt, i) => (
                      <TableCell key={i} className="text-right font-mono tabular-nums">
                        {reportResultMoney(amt, data!.currencyCode, presentation)}
                      </TableCell>
                    ))}
                    <TableCell className="text-right font-mono tabular-nums">
                      {reportResultMoney(data.netIncome.total, data!.currencyCode, presentation)}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </ContentReveal>
      )}
    </ContentReveal>
  );
}

function RenderSection({
  section,
  currencyCode,
  columns,
  ledgerHref,
}: {
  section: SectionData;
  currencyCode: string;
  columns: ColumnDesc[];
  ledgerHref: (accountId: string, col: ColumnDesc) => string;
}) {
  const presentation = usePresentation();
  const t = useTranslations("AnalyticalReports");
  return (
    <>
      <TableRow className="bg-muted/30">
        <TableCell colSpan={columns.length + 2} className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {t(section.label === "Revenue" ? "revenue" : "expenses")}
        </TableCell>
      </TableRow>
      {section.accounts.map((a) => (
        <TableRow key={a.accountId}>
          <TableCell>
            <span className="font-mono text-xs text-muted-foreground mr-2">{a.accountCode}</span>
            {a.accountName}
          </TableCell>
          {columns.map((c, i) => (
            <TableCell key={c.key} className="text-right font-mono tabular-nums">
              {a.amounts[i] !== 0n ? (
                <Link href={ledgerHref(a.accountId, c)} className="hover:text-emerald-600 hover:underline">
                  {reportResultMoney(a.amounts[i], currencyCode, presentation)}
                </Link>
              ) : (
                <span className="text-muted-foreground/50">{reportResultMoney(0n, currencyCode, presentation)}</span>
              )}
            </TableCell>
          ))}
          <TableCell className="text-right font-mono tabular-nums">{reportResultMoney(a.total, currencyCode, presentation)}</TableCell>
        </TableRow>
      ))}
      <TableRow className="font-semibold">
        <TableCell>{t(section.label === "Revenue" ? "totalRevenue" : "totalExpenses")}</TableCell>
        {section.totals.map((t, i) => (
          <TableCell key={i} className="text-right font-mono tabular-nums">{reportResultMoney(t, currencyCode, presentation)}</TableCell>
        ))}
        <TableCell className="text-right font-mono tabular-nums">{reportResultMoney(section.total, currencyCode, presentation)}</TableCell>
      </TableRow>
    </>
  );
}
