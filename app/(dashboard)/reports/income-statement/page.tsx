"use client";

import { usePresentation } from "@/i18n/provider";
import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";

import { BrandLoader } from "@/components/dashboard/brand-loader";
import { ErrorState } from "@/components/dashboard/error-state";
import { financialStatementJson, incomeStatementUi, statementUiMoney, type IncomeStatementUi } from "@/lib/money/financial-statement-ui";
import { ContentReveal } from "@/components/ui/content-reveal";
import { PageHeader } from "@/components/dashboard/page-header";
import { BackToReports, ReportHelp } from "../_components";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = [0, 1, 2, 3, 4].map((n) => CURRENT_YEAR - n);

export default function IncomeStatementPage() {
  const presentation = usePresentation();
  const t = useTranslations("IncomeReports");
  const [initialLoad, setInitialLoad] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [data, setData] = useState<IncomeStatementUi | null>(null);
  const [year, setYear] = useState(CURRENT_YEAR);

  useEffect(() => {
    const orgId = localStorage.getItem("activeOrgId");
    if (!orgId) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(false);

    // Always request a concrete year range so the figures are "for the year",
    // not a lifetime running total.
    const from = `${year}-01-01`;
    const to =
      year === CURRENT_YEAR
        ? new Date().toISOString().slice(0, 10)
        : `${year}-12-31`;

    fetch(`/api/v1/reports/income-statement?from=${from}&to=${to}`, {
      headers: { "x-organization-id": orgId },
    })
      .then((r) => financialStatementJson(r, incomeStatementUi))
      .then((d) => {
        if (cancelled) return;
        if (d.revenue) setData(d);
      })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
          setInitialLoad(false);
        }
      });
    return () => { cancelled = true; };
  }, [year]);

  if (initialLoad) return <BrandLoader />;
  if (error) return <ErrorState message={t("loadFailed")} onRetry={() => window.location.reload()} />;

  return (
    <ContentReveal className="space-y-6">
      <BackToReports />

      <PageHeader
        title={t("incomeTitle")}
        description={t("incomeDescription")}
      >
        <select
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="h-9 rounded-md border bg-background px-3 text-sm"
          aria-label={t("year")}
        >
          {YEAR_OPTIONS.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </PageHeader>

      <ReportHelp>
        {t("incomeHelp")}
      </ReportHelp>

      {loading ? (
        <BrandLoader className="h-48" />
      ) : !data ? (
        <p className="text-muted-foreground">{t("noData")}</p>
      ) : (
        <ContentReveal>
          <div className="space-y-6">
            {[
              { key: "revenue", label: t("moneyIn"), totalLabel: t("totalIncome"), section: data.revenue },
              { key: "expenses", label: t("moneyOut"), totalLabel: t("totalCosts"), section: data.expenses },
            ].map((s) => (
              <div key={s.key} className="space-y-2">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  {s.label}
                </h3>
                <div className="rounded-lg border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="w-24">{t("code")}</TableHead>
                        <TableHead>{t("account")}</TableHead>
                        <TableHead className="w-32 text-right">{t("amount")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {s.section.accounts.map((a) => (
                        <TableRow key={a.code}>
                          <TableCell className="font-mono text-sm">{a.code}</TableCell>
                          <TableCell>{a.name}</TableCell>
                          <TableCell className="text-right font-mono tabular-nums">
                            {statementUiMoney(a.balance, data.currencyCode, presentation)}
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="bg-muted/30 font-bold">
                        <TableCell colSpan={2}>{s.totalLabel}</TableCell>
                        <TableCell className="text-right font-mono tabular-nums">
                          {statementUiMoney(s.section.total, data.currencyCode, presentation)}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </div>
            ))}

            <div className="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 p-4 sm:p-6">
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">
                  {t("profit")}
                </span>
                <span className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-emerald-700 dark:text-emerald-300">
                  {statementUiMoney(data.netIncome, data.currencyCode, presentation)}
                </span>
              </div>
            </div>
          </div>
        </ContentReveal>
      )}
    </ContentReveal>
  );
}
