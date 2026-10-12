"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { BrandLoader } from "@/components/dashboard/brand-loader";
import { ContentReveal } from "@/components/ui/content-reveal";
import { ExportButton } from "@/components/dashboard/export-button";
import { balanceSheetUi, financialStatementJson, statementComparisonDates, statementComparisonPeriods, statementUiMoney } from "@/lib/money/financial-statement-ui";
import { ErrorState } from "@/components/dashboard/error-state";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type PeriodBalance = ReturnType<typeof statementComparisonPeriods>[number];

export default function ComparativeBalanceSheetPage() {
  const [initialLoad, setInitialLoad] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [periods, setPeriods] = useState<PeriodBalance[]>([]);
  const [compareMonths, setCompareMonths] = useState(3);

  useEffect(() => {
    const orgId = localStorage.getItem("activeOrgId");
    if (!orgId) return;
    let cancelled = false;
    setLoading(true);

    setError(null);
    const dates = statementComparisonDates(new Date().toISOString().slice(0, 10), compareMonths);
    const params = new URLSearchParams({ asAt: dates[0] });
    for (const date of dates.slice(1)) params.append("compareDate", date);
    fetch(`/api/v1/reports/balance-sheet?${params}`, {
      headers: { "x-organization-id": orgId },
    })
      .then(response => financialStatementJson(response, balanceSheetUi))
      .then(data => { if (!cancelled) setPeriods(statementComparisonPeriods(data)); })
      .catch((error: Error) => { if (!cancelled) setError(error.message); })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
          setInitialLoad(false);
        }
      });

    return () => { cancelled = true; };
  }, [compareMonths]);

  // Collect all unique account names across periods
  const allAccounts = new Map<string, { accountId: string; code: string; name: string; section: string }>();
  for (const p of periods) {
    for (const a of p.assets.accounts) allAccounts.set(a.accountId, { ...a, section: "Assets" });
    for (const a of p.liabilities.accounts) allAccounts.set(a.accountId, { ...a, section: "Liabilities" });
    for (const a of p.equity.accounts) allAccounts.set(a.accountId, { ...a, section: "Equity" });
  }

  const sections = ["Assets", "Liabilities", "Equity"] as const;

  const exportData = Array.from(allAccounts.entries()).map(([accountId, info]) => {
    const row: Record<string, unknown> = { section: info.section, code: info.code, name: info.name, currencyCode: periods[0]?.currencyCode };
    for (const p of periods) {
      const sectionData = info.section === "Assets" ? p.assets : info.section === "Liabilities" ? p.liabilities : p.equity;
      const acct = sectionData.accounts.find((a) => a.accountId === accountId);
      row[p.label + "Minor"] = (acct?.balance ?? 0n).toString();
    }
    return row;
  });

  if (initialLoad) return <BrandLoader />;
  if (error) return <ErrorState message={error} onRetry={() => window.location.reload()} />;

  return (
    <ContentReveal className="space-y-6">
      <Link href="/reports" className="flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="size-3.5" /> Back to reports
      </Link>

      <PageHeader title="What you own and owe — compared" description="What the business owns and owes at several dates, side by side, to show what changed.">
        <ExportButton data={exportData} columns={["section", "code", "name", "currencyCode", ...periods.map((p) => p.label + "Minor")]} filename="comparative-balance-sheet" />
      </PageHeader>

      <div className="flex items-center gap-3">
        <Select value={String(compareMonths)} onValueChange={(v) => setCompareMonths(Number(v))}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="2">2 periods</SelectItem>
            <SelectItem value="3">3 periods</SelectItem>
            <SelectItem value="4">4 periods</SelectItem>
            <SelectItem value="6">6 periods</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <BrandLoader className="h-48" />
      ) : periods.length === 0 ? (
        <ContentReveal>
          <div className="rounded-xl border border-dashed py-12 text-center">
            <p className="text-sm text-muted-foreground">No balance sheet data available.</p>
          </div>
        </ContentReveal>
      ) : (
        <ContentReveal>
          <div className="rounded-lg border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground sticky left-0 bg-muted/30 min-w-[200px]">Account</th>
                  {periods.map((p) => (
                    <th key={p.label} className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground min-w-[120px]">
                      {p.label}
                    </th>
                  ))}
                  {periods.length >= 2 && (
                    <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground min-w-[100px]">Change</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {sections.map((section) => {
                  const sectionAccounts = Array.from(allAccounts.entries())
                    .filter(([, info]) => info.section === section)
                    .sort(([, a], [, b]) => a.code.localeCompare(b.code));

                  return (
                    <React.Fragment key={section}>
                      <tr className="bg-muted/20">
                        <td className="px-4 py-2 font-semibold text-xs uppercase tracking-wide sticky left-0 bg-muted/20" colSpan={periods.length + 2}>
                          {section}
                        </td>
                      </tr>
                      {sectionAccounts.map(([accountId, info]) => {
                        const values = periods.map((p) => {
                          const sData = section === "Assets" ? p.assets : section === "Liabilities" ? p.liabilities : p.equity;
                          return sData.accounts.find((a) => a.accountId === accountId)?.balance ?? 0n;
                        });
                        const change = periods.length >= 2 ? values[values.length - 1] - values[0] : 0n;

                        return (
                          <tr key={accountId} className="border-b last:border-b-0">
                            <td className="px-4 py-2 sticky left-0 bg-background">
                              <span className="text-muted-foreground font-mono text-xs mr-2">{info.code}</span>
                              {info.name}
                            </td>
                            {values.map((v, i) => (
                              <td key={i} className="px-4 py-2 text-right font-mono tabular-nums">{statementUiMoney(v, periods[i].currencyCode)}</td>
                            ))}
                            {periods.length >= 2 && (
                              <td className={cn("px-4 py-2 text-right font-mono tabular-nums text-xs", change > 0 ? "text-emerald-600" : change < 0 ? "text-red-600" : "text-muted-foreground")}>
                                {change !== 0n ? `${change > 0 ? "+" : ""}${statementUiMoney(change, periods[0].currencyCode)}` : "-"}
                              </td>
                            )}
                          </tr>
                        );
                      })}
                      {/* Section total */}
                      <tr className="border-b bg-muted/10">
                        <td className="px-4 py-2 font-semibold sticky left-0 bg-muted/10">Total {section}</td>
                        {periods.map((p) => {
                          const total = section === "Assets" ? p.assets.total : section === "Liabilities" ? p.liabilities.total : p.equity.total;
                          return (
                            <td key={p.label} className="px-4 py-2 text-right font-mono tabular-nums font-semibold">{statementUiMoney(total, p.currencyCode)}</td>
                          );
                        })}
                        {periods.length >= 2 && <td />}
                      </tr>
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </ContentReveal>
      )}
    </ContentReveal>
  );
}
