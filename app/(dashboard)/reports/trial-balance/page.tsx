"use client";

import Link from "next/link";
import { Fragment, useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { accountTypeLabel } from "@/i18n/account-presentation";
import { BrandLoader } from "@/components/dashboard/brand-loader";
import { ErrorState } from "@/components/dashboard/error-state";
import { financialStatementJson, trialBalanceUi, trialBalanceTotals, statementUiMoney, type TrialBalanceUi } from "@/lib/money/financial-statement-ui";
import { ContentReveal } from "@/components/ui/content-reveal";
import { PageHeader } from "@/components/dashboard/page-header";
import { DatePicker } from "@/components/ui/date-picker";
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
import { BackToReports, ReportHelp } from "../_components";

type AccountBalance = TrialBalanceUi["accounts"][number];
type SplitBalance = Pick<AccountBalance, "balance" | "debitBalance" | "creditBalance">;

export default function TrialBalancePage() {
  const t = useTranslations("LedgerReports");
  const ta = useTranslations("Accounts");
  const today = new Date().toISOString().slice(0, 10);
  const [initialLoad, setInitialLoad] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [asAt, setAsAt] = useState(today);
  const [compareDate, setCompareDate] = useState("");
  const [showCompare, setShowCompare] = useState(false);
  const [data, setData] = useState<TrialBalanceUi | null>(null);

  useEffect(() => {
    const orgId = localStorage.getItem("activeOrgId");
    if (!orgId) return;
    let cancelled = false;
    setLoading(true);
    setError(false);
    const params = new URLSearchParams({ asAt });
    if (showCompare && compareDate) params.set("compareDate", compareDate);

    fetch(`/api/v1/reports/trial-balance?${params}`, {
      headers: { "x-organization-id": orgId },
    })
      .then((r) => financialStatementJson(r, trialBalanceUi))
      .then((d) => {
        if (cancelled) return;
        if (d.accounts) setData(d);
      })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
          setInitialLoad(false);
        }
      });
    return () => { cancelled = true; };
  }, [asAt, showCompare, compareDate]);

  if (initialLoad) return <BrandLoader />;
  if (error) return <ErrorState message={t("loadFailed")} onRetry={() => window.location.reload()} />;

  const accounts = data?.accounts ?? [];
  const dates = data?.dates ?? (data ? [data.asAt] : []);

  function splitsFor(a: AccountBalance): SplitBalance[] {
    return a.balances ?? [a];
  }

  const totals = data ? trialBalanceTotals(data) : [];
  const formatMoney = (value: bigint) => statementUiMoney(value, data!.currencyCode);

  return (
    <ContentReveal className="space-y-6">
      <BackToReports />

      <PageHeader
        title={t("trialTitle")}
        description={t("trialDescription")}
      >
        <ExportButton
          data={accounts.map(row => ({ ...row, currencyCode: data!.currencyCode, debitBalance: row.debitBalanceMinor, creditBalance: row.creditBalanceMinor }))}
          columns={["code", "name", "type", "currencyCode", "debitBalanceMinor", "creditBalanceMinor"]}
          filename="account-balances"
        />
      </PageHeader>

      <ReportHelp>
        {t("trialHelp")}
      </ReportHelp>

      <div className="flex flex-col gap-3 rounded-lg border bg-muted/20 p-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
        <div className="flex items-center gap-2">
          <span className="text-[13px] text-muted-foreground">{t("asOfLabel")}</span>
          <DatePicker value={asAt} onChange={setAsAt} className="w-40 h-8 text-sm" />
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={showCompare ? "default" : "outline"}
            size="sm"
            onClick={() => setShowCompare((v) => !v)}
            className={showCompare ? "bg-emerald-600 hover:bg-emerald-700" : ""}
          >
            {t(showCompare ? "comparingEarlier" : "compareEarlier")}
          </Button>
          {showCompare && (
            <DatePicker
              value={compareDate}
              onChange={setCompareDate}
              placeholder={t("earlierDate")}
              className="w-40 h-8 text-sm"
            />
          )}
        </div>
      </div>

      {loading ? (
        <BrandLoader className="h-48" />
      ) : (
        <ContentReveal>
          <div className="rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-24">{t("code")}</TableHead>
                  <TableHead>{t("account")}</TableHead>
                  <TableHead className="w-24">{t("type")}</TableHead>
                  {dates.map((d) => (
                    <TableHead key={d} colSpan={2} className="text-center">{t("asOfDate", { date: d })}</TableHead>
                  ))}
                </TableRow>
                <TableRow className="bg-muted/30">
                  <TableHead colSpan={3} />
                  {dates.map((d) => (
                    <Fragment key={d}>
                      <TableHead className="w-28 text-right text-xs">{t("moneyInSide")}</TableHead>
                      <TableHead className="w-28 text-right text-xs">{t("moneyOutSide")}</TableHead>
                    </Fragment>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.map((a) => (
                  <TableRow key={a.accountId}>
                    <TableCell className="font-mono text-sm">{a.code}</TableCell>
                    <TableCell className="font-medium">
                      <Link
                        href={`/reports/general-ledger?${new URLSearchParams({ endDate: asAt }).toString()}#${a.accountId}`}
                        className="hover:text-emerald-600 hover:underline"
                      >
                        {a.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground capitalize">{accountTypeLabel(ta, a.type)}</TableCell>
                    {splitsFor(a).map((s, i) => (
                      <Fragment key={i}>
                        <TableCell className="text-right font-mono tabular-nums">
                          {s.debitBalance > 0n ? formatMoney(s.debitBalance) : ""}
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums">
                          {s.creditBalance > 0n ? formatMoney(s.creditBalance) : ""}
                        </TableCell>
                      </Fragment>
                    ))}
                  </TableRow>
                ))}
                <TableRow className="bg-muted/30 font-bold">
                  <TableCell colSpan={3}>{t("total")}</TableCell>
                  {totals.map((t, i) => (
                    <Fragment key={i}>
                      <TableCell className="text-right font-mono tabular-nums">
                        {formatMoney(t.debit)}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {formatMoney(t.credit)}
                      </TableCell>
                    </Fragment>
                  ))}
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </ContentReveal>
      )}
    </ContentReveal>
  );
}
