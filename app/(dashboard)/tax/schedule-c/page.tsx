"use client";

import { BidiText, IdentifierText } from "@/components/ui/bidi-text";

import { usePresentation } from "@/i18n/provider";
import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { scheduleCLineLabelKey } from "@/lib/i18n/tax-filing-presentation";
import { TrendingUp, TrendingDown, DollarSign, Printer, Info } from "lucide-react";
import { DateRangeFilter } from "@/components/dashboard/date-range-filter";
import { ExportButton } from "@/components/dashboard/export-button";
import { PageHeader } from "@/components/dashboard/page-header";
import { BrandLoader } from "@/components/dashboard/brand-loader";
import { ContentReveal } from "@/components/ui/content-reveal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { taxUiMinor, taxUiCurrency, taxUiRows, taxUiMoney, taxUiAbs, taxUiMax, taxUiPercent } from "@/lib/money/tax-ui";
import { cn } from "@/lib/utils";
import { useDocumentTitle } from "@/lib/hooks/use-document-title";

interface ScheduleCLine {
  line: string;
  label: string;
  amount: bigint;
}

const INCOME_LINES = ["1", "2", "3", "4", "5", "6", "7"];
const SUMMARY_LINES = ["28", "29", "30", "31"];

export default function ScheduleCPage() {
  const orgId = typeof window !== "undefined" ? localStorage.getItem("activeOrgId") : null;
  return <ScheduleCPageWorkspace key={orgId} orgId={orgId} />;
}

function ScheduleCPageWorkspace({ orgId }: { orgId: string | null }) {
  const presentation = usePresentation();
  const t = useTranslations("ScheduleCReport");
  const lineLabel = (line: ScheduleCLine) => {
    const key = scheduleCLineLabelKey(line.line);
    return key ? t(key) : line.label;
  };
  const now = new Date();
  const [startDate, setStartDate] = useState(`${now.getFullYear()}-01-01`);
  const [endDate, setEndDate] = useState(`${now.getFullYear()}-12-31`);
  const [lines, setLines] = useState<ScheduleCLine[]>([]);
  const [totalIncome, setTotalIncome] = useState(0n);
  const [totalExpenses, setTotalExpenses] = useState(0n);
  const [netProfit, setNetProfit] = useState(0n);
  const [loading, setLoading] = useState(true);
  const [currency, setCurrency] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useDocumentTitle(t("documentTitle"));

  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams({ startDate, endDate });
    fetch(`/api/v1/reports/schedule-c?${params}`, {
      headers: { "x-organization-id": orgId },
    })
      .then((r) => { if (!r.ok) throw new Error("Could not load tax report"); return r.json(); })
      .then((data) => {
        if (cancelled) return;
        const code = taxUiCurrency(data.currencyCode);
        const rows = taxUiRows(data.lines as (Omit<ScheduleCLine, "amount"> & { amount: number })[], ["amount"]);
        const income = taxUiMinor(data.totalIncome, data.totalIncomeMinor);
        const expenses = taxUiMinor(data.totalExpenses, data.totalExpensesMinor);
        const profit = taxUiMinor(data.netProfit, data.netProfitMinor);
        setLines(rows);
        setCurrency(code); setError(null);
        setTotalIncome(income);
        setTotalExpenses(expenses);
        setNetProfit(profit);
      })
      .catch(() => { if (!cancelled) { setError(t("loadFailed")); setCurrency(null); } })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, [startDate, endDate, orgId, t]);

  const incomeLines = lines.filter((l) => INCOME_LINES.includes(l.line));
  const expenseLines = lines.filter((l) => !INCOME_LINES.includes(l.line) && !SUMMARY_LINES.includes(l.line));
  const summaryLines = lines.filter((l) => SUMMARY_LINES.includes(l.line));

  const maxIncExp = taxUiMax(totalIncome, totalExpenses);
  const incomePct = taxUiPercent(totalIncome, maxIncExp);
  const expensesPct = taxUiPercent(totalExpenses, maxIncExp);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        description={t("description")}
      >
        <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => window.print()}>
          <Printer className="size-3.5" />
          {t("print")}
        </Button>
        <ExportButton
          data={(error || loading || !currency ? [] : lines).map((l) => ({
            line: l.line,
            description: l.label,
            amount: l.amount.toString(), currencyCode: currency,
          }))}
          columns={["line", "description", "amount", "currencyCode"]}
          filename={`schedule-c-${startDate.slice(0, 4)}`}
        />
      </PageHeader>

      <div className="flex flex-wrap gap-y-2 items-start gap-2.5 rounded-lg border border-border bg-muted/30 px-3.5 py-2.5">
        <Info className="size-4 text-muted-foreground shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          <span className="font-medium text-foreground">{t("worksheetNoticeTitle")}</span>{" "}{t("worksheetNotice")}
        </p>
      </div>

      <DateRangeFilter
        startDate={startDate}
        endDate={endDate}
        onDateChange={(s, e) => { setStartDate(s); setEndDate(e); }}
      />

      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : loading || !currency ? (
        <BrandLoader className="h-48" />
      ) : (
        <ContentReveal className="space-y-6">
          {/* Income vs Expenses comparison */}
          <div className="rounded-lg border bg-card p-5">
            <h3 className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground">
              {t("comparison")}
            </h3>
            <div className="mt-4 space-y-3">
              <div className="space-y-1.5">
                <div className="flex flex-wrap gap-y-2 items-center justify-between text-sm">
                  <div className="flex flex-wrap gap-y-2 items-center gap-2">
                    <TrendingUp className="size-3.5 text-emerald-500" />
                    <span className="text-muted-foreground">{t("grossIncome")}</span>
                  </div>
                  <span className="font-mono text-sm tabular-nums font-medium text-emerald-600 dark:text-emerald-400">
                    <BidiText>{taxUiMoney(totalIncome, currency!, presentation)}</BidiText>
                  </span>
                </div>
                <div className="h-2 rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all"
                    style={{ width: `${incomePct}%` }}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="flex flex-wrap gap-y-2 items-center justify-between text-sm">
                  <div className="flex flex-wrap gap-y-2 items-center gap-2">
                    <TrendingDown className="size-3.5 text-red-500" />
                    <span className="text-muted-foreground">{t("totalExpenses")}</span>
                  </div>
                  <span className="font-mono text-sm tabular-nums font-medium text-red-600 dark:text-red-400">
                    <BidiText>{taxUiMoney(totalExpenses, currency!, presentation)}</BidiText>
                  </span>
                </div>
                <div className="h-2 rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-red-500 transition-all"
                    style={{ width: `${expensesPct}%` }}
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-y-2 items-center justify-between border-t pt-3">
                <div className="flex flex-wrap gap-y-2 items-center gap-2">
                  <DollarSign className="size-3.5 text-muted-foreground" />
                  <span className="text-sm font-medium">{t("netProfitLoss")}</span>
                </div>
                <span className={cn(
                  "font-mono text-sm tabular-nums font-semibold",
                  netProfit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                )}>
                  <BidiText>{taxUiMoney(netProfit, currency!, presentation)}</BidiText>
                </span>
              </div>
            </div>
          </div>

          {/* Net result hero */}
          <div className={cn(
            "rounded-xl border-2 p-5",
            netProfit >= 0
              ? "border-emerald-200 bg-emerald-50/60 dark:border-emerald-900 dark:bg-emerald-950/20"
              : "border-red-200 bg-red-50/60 dark:border-red-900 dark:bg-red-950/20"
          )}>
            <div className="flex flex-wrap gap-y-2 items-center justify-between">
              <div>
                <p className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground">
                  {netProfit >= 0 ? t("lineProfit") : t("lineLoss")}
                </p>
                <p className={cn(
                  "mt-1 text-2xl font-bold font-mono tabular-nums",
                  netProfit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                )}>
                  <BidiText>{taxUiMoney(taxUiAbs(netProfit), currency!, presentation)}</BidiText>
                </p>
              </div>
              <div className={cn(
                "flex size-12 items-center justify-center rounded-xl",
                netProfit >= 0
                  ? "bg-emerald-100 dark:bg-emerald-900/40"
                  : "bg-red-100 dark:bg-red-900/40"
              )}>
                <DollarSign className={cn(
                  "size-5",
                  netProfit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                )} />
              </div>
            </div>
          </div>

          <div className="space-y-6">
            {/* Income section */}
            {incomeLines.length > 0 && (
              <div>
                <div className="flex flex-wrap gap-y-2 items-center gap-2 mb-2">
                  <h3 className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground">{t("incomePart")}</h3>
                  <Badge variant="outline" className="text-[10px]">{t("incomeLines")}</Badge>
                </div>
                <div className="rounded-lg border overflow-x-auto">
                  {incomeLines.map((l, i) => (
                    <div
                      key={l.line}
                      className={cn(
                        "flex items-center justify-between px-4 py-3",
                        i < incomeLines.length - 1 && "border-b"
                      )}
                    >
                      <div className="flex flex-wrap gap-y-2 items-center gap-3">
                        <span className="flex size-7 items-center justify-center rounded-md bg-muted text-[11px] font-mono font-bold text-muted-foreground"><IdentifierText>{l.line}</IdentifierText></span>
                        <span className="text-sm"><BidiText>{lineLabel(l)}</BidiText></span>
                      </div>
                      <span className="font-mono text-sm tabular-nums font-medium"><BidiText>{taxUiMoney(l.amount, currency!, presentation)}</BidiText></span>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap gap-y-2 justify-between items-center px-4 py-2.5 mt-2 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg border border-emerald-200 dark:border-emerald-900/40 text-sm font-semibold">
                  <span>{t("grossIncome")}</span>
                  <span className="font-mono tabular-nums text-emerald-600 dark:text-emerald-400"><BidiText>{taxUiMoney(totalIncome, currency!, presentation)}</BidiText></span>
                </div>
              </div>
            )}

            {/* Expenses section */}
            {expenseLines.length > 0 && (
              <div>
                <div className="flex flex-wrap gap-y-2 items-center gap-2 mb-2">
                  <h3 className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground">{t("expensesPart")}</h3>
                  <Badge variant="outline" className="text-[10px]">{t("expenseLines")}</Badge>
                </div>
                <div className="rounded-lg border overflow-x-auto">
                  {expenseLines.map((l, i) => (
                    <div
                      key={l.line}
                      className={cn(
                        "flex items-center justify-between px-4 py-3",
                        i < expenseLines.length - 1 && "border-b",
                        l.amount === 0n && "opacity-40"
                      )}
                    >
                      <div className="flex flex-wrap gap-y-2 items-center gap-3">
                        <span className="flex size-7 items-center justify-center rounded-md bg-muted text-[11px] font-mono font-bold text-muted-foreground"><IdentifierText>{l.line}</IdentifierText></span>
                        <span className="text-sm"><BidiText>{lineLabel(l)}</BidiText></span>
                      </div>
                      <span className="font-mono text-sm tabular-nums font-medium">
                        <BidiText>{l.amount === 0n ? "-" : taxUiMoney(l.amount, currency!, presentation)}</BidiText>
                      </span>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap gap-y-2 justify-between items-center px-4 py-2.5 mt-2 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-900/40 text-sm font-semibold">
                  <span>{t("totalExpenses")}</span>
                  <span className="font-mono tabular-nums text-red-600 dark:text-red-400"><BidiText>{taxUiMoney(totalExpenses, currency!, presentation)}</BidiText></span>
                </div>
              </div>
            )}

            {/* Summary section */}
            {summaryLines.length > 0 && (
              <div>
                <h3 className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground mb-2">{t("summary")}</h3>
                <div className="rounded-lg border overflow-x-auto">
                  {summaryLines.map((l, i) => {
                    const isNet = l.line === "31";
                    return (
                      <div
                        key={l.line}
                        className={cn(
                          "flex items-center justify-between px-4 py-3",
                          i < summaryLines.length - 1 && "border-b",
                          isNet && "bg-muted/40"
                        )}
                      >
                        <div className="flex flex-wrap gap-y-2 items-center gap-3">
                          <span className={cn(
                            "flex size-7 items-center justify-center rounded-md text-[11px] font-mono font-bold",
                            isNet ? "bg-foreground text-background" : "bg-muted text-muted-foreground"
                          )}><IdentifierText>{l.line}</IdentifierText></span>
                          <span className={cn("text-sm", isNet && "font-semibold")}><BidiText>{lineLabel(l)}</BidiText></span>
                        </div>
                        <span className={cn(
                          "font-mono text-sm tabular-nums font-medium",
                          isNet && "text-base font-bold",
                          isNet && (l.amount >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")
                        )}>
                          <BidiText>{taxUiMoney(l.amount, currency!, presentation)}</BidiText>
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </ContentReveal>
      )}
    </div>
  );
}
