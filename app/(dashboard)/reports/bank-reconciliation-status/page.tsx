"use client";

import { bankStatusUi, analyticalReportJson } from "@/lib/money/analytical-report-ui";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { BrandLoader } from "@/components/dashboard/brand-loader";
import { ContentReveal } from "@/components/ui/content-reveal";
import { PageHeader } from "@/components/dashboard/page-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ExportButton } from "@/components/dashboard/export-button";
import { analyticalMoney as formatMoney } from "@/lib/money/analytical-report-ui";
import { money, toMajorDecimal } from "@/lib/money/exact";
import { bankTotalDecimal } from "@/lib/reports/bank-analytics-display";
import { BackToReports, ReportHelp } from "../_components";

type StatusData = ReturnType<typeof bankStatusUi>;

function fmtDate(d: string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toISOString().slice(0, 10);
}

export default function BankReconciliationStatusPage() {
  const t = useTranslations("BankingReports");
  const [initialLoad, setInitialLoad] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [data, setData] = useState<StatusData | null>(null);

  useEffect(() => {
    const orgId = localStorage.getItem("activeOrgId");
    if (!orgId) return;
    let cancelled = false;
    setLoading(true);

    fetch(`/api/v1/reports/bank-reconciliation-status`, {
      headers: { "x-organization-id": orgId },
    })
      .then((r) => analyticalReportJson(r, bankStatusUi))
      .then((d) => {
        if (cancelled) return;
        setError(false);
        setData(d);
      })
      .catch(() => { if (!cancelled) { setData(null); setError(true); } })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
          setInitialLoad(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (initialLoad) return <BrandLoader />;

  const accounts = data?.accounts ?? [];

  const totalCount = accounts.reduce((count, a) => count + a.unreconciled.count, 0);
  const currencyTotals = new Map<string, bigint>();
  for (const account of accounts) currencyTotals.set(account.currencyCode,
    (currencyTotals.get(account.currencyCode) ?? 0n) + BigInt(account.unreconciled.total));

  const exportRows = accounts.map((a) => ({
    accountName: a.accountName,
    currencyCode: a.currencyCode,
    balance: toMajorDecimal(money(BigInt(a.balance), a.currencyCode)),
    toReviewCount: a.unreconciled.count,
    toReviewTotal: toMajorDecimal(money(BigInt(a.unreconciled.total), a.currencyCode)),
    olderThan60Days: a.unreconciled.aging.older.count,
    lastReviewed: fmtDate(a.lastReconciliation?.endDate),
    lastImport: fmtDate(a.lastImport?.date),
  }));

  return (
    <ContentReveal className="space-y-6">
      <BackToReports />

      <PageHeader
        title={t("statusTitle")}
        description={t("statusDescription")}
      >
        <ExportButton
          data={loading || error ? [] : exportRows}
          columns={[
            "accountName",
            "currencyCode",
            "balance",
            "toReviewCount",
            "toReviewTotal",
            "olderThan60Days",
            "lastReviewed",
            "lastImport",
          ]}
          filename="bank-tidy-up-status"
        />
      </PageHeader>

      {error && <p role="alert" className="text-sm text-destructive">{t("statusError")}</p>}

      <ReportHelp>{t("statusHelp")}</ReportHelp>

      {loading ? (
        <BrandLoader className="h-48" />
      ) : error ? null : accounts.length === 0 ? (
        <ContentReveal>
          <div className="rounded-lg border bg-muted/20 p-8 text-center text-sm text-muted-foreground">
            {t("statusEmpty")}
          </div>
        </ContentReveal>
      ) : (
        <ContentReveal className="space-y-4">
          <div className="rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>{t("account")}</TableHead>
                  <TableHead className="text-right">{t("balance")}</TableHead>
                  <TableHead className="text-right">{t("toReview")}</TableHead>
                  <TableHead className="text-right">{t("waitingValue")}</TableHead>
                  <TableHead className="text-right">{t("older")}</TableHead>
                  <TableHead>{t("lastReviewed")}</TableHead>
                  <TableHead>{t("lastImport")}</TableHead>
                  <TableHead>{t("status")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.map((a) => {
                  const isClear = a.unreconciled.count === 0;
                  const olderCount = a.unreconciled.aging.older.count;
                  return (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">
                        <Link
                          href={`/accounting/banking/${a.id}`}
                          className="hover:text-emerald-600 hover:underline"
                        >
                          {a.accountName}
                        </Link>
                        {a.gaps.hasGap && (
                          <div className="mt-0.5 flex items-center gap-1 text-xs text-amber-600">
                            <AlertTriangle className="size-3" />
                            {t("gap", { days: a.gaps.gapDays ?? 0 })}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {formatMoney(a.balance, a.currencyCode)}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {a.unreconciled.count}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {a.unreconciled.total > 0
                          ? formatMoney(a.unreconciled.total, a.currencyCode)
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {olderCount > 0 ? (
                          <span className="text-amber-600 font-medium">
                            {olderCount}
                          </span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {fmtDate(a.lastReconciliation?.endDate)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {fmtDate(a.lastImport?.date)}
                      </TableCell>
                      <TableCell>
                        {isClear ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                            <CheckCircle2 className="size-3" /> {t("caughtUp")}
                          </span>
                        ) : (
                          <Link
                            href={`/accounting/banking/${a.id}/reconcile`}
                            className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 hover:bg-amber-100"
                          >
                            {t("reviewCount", { count: a.unreconciled.count })}
                          </Link>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
                <TableRow className="bg-muted/30 font-bold">
                  <TableCell>{t("total")}</TableCell>
                  <TableCell />
                  <TableCell className="text-right font-mono tabular-nums">
                    {totalCount}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {[...currencyTotals].map(([currency, total]) => (
                      <div key={currency}>{currency} {bankTotalDecimal(total, currency)}</div>
                    ))}
                  </TableCell>
                  <TableCell colSpan={4} />
                </TableRow>
              </TableBody>
            </Table>
          </div>

          <p className="text-xs text-muted-foreground">
            {t("statusNote")}
          </p>
        </ContentReveal>
      )}
    </ContentReveal>
  );
}
