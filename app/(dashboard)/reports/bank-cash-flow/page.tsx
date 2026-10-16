"use client";

import { bankCashFlowUi, bankAccountPickerUi, analyticalReportJson, analyticalAbs } from "@/lib/money/analytical-report-ui";
import { useState, useEffect } from "react";
import { ArrowDownToLine, ArrowUpFromLine, Wallet } from "lucide-react";
import { BrandLoader } from "@/components/dashboard/brand-loader";
import { ContentReveal } from "@/components/ui/content-reveal";
import { PageHeader } from "@/components/dashboard/page-header";
import { DateRangeFilter } from "@/components/dashboard/date-range-filter";
import { StatCard } from "@/components/dashboard/stat-card";
import { ExportButton } from "@/components/dashboard/export-button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { analyticalMoney as formatMoney } from "@/lib/money/analytical-report-ui";
import { BackToReports, ReportHelp } from "../_components";

type BankCashFlowData = ReturnType<typeof bankCashFlowUi>;

interface BankAccount {
  id: string;
  accountName: string;
  currencyCode?: string;
}

const GROUP_OPTIONS: { value: string; label: string }[] = [
  { value: "day", label: "By day" },
  { value: "week", label: "By week" },
  { value: "month", label: "By month" },
];

export default function BankCashFlowPage() {
  const now = new Date();
  const [initialLoad, setInitialLoad] = useState(true);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(`${now.toISOString().slice(0, 4)}-01-01`);
  const [endDate, setEndDate] = useState(now.toISOString().slice(0, 10));
  const [groupBy, setGroupBy] = useState("month");
  const [bankAccountId, setBankAccountId] = useState("");
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<BankCashFlowData | null>(null);

  // Load the org's bank accounts for the account picker.
  useEffect(() => {
    const orgId = localStorage.getItem("activeOrgId");
    if (!orgId) return;
    let cancelled = false;
    fetch("/api/v1/bank-accounts", {
      headers: { "x-organization-id": orgId },
    })
      .then((r) => analyticalReportJson(r, bankAccountPickerUi))
      .then((d) => {
        if (cancelled) return;
        setAccounts(d.bankAccounts);
      })
      .catch(() => { if (!cancelled) setAccounts([]); });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const orgId = localStorage.getItem("activeOrgId");
    if (!orgId) return;
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams({ startDate, endDate, groupBy });
    if (bankAccountId) params.set("bankAccountId", bankAccountId);
    fetch(`/api/v1/reports/bank-cash-flow?${params}`, {
      headers: { "x-organization-id": orgId },
    })
      .then((r) => analyticalReportJson(r, bankCashFlowUi))
      .then((d) => {
        if (cancelled) return;
        setError(null);
        setData(d);
      })
      .catch((err: unknown) => {
        if (!cancelled) { setData(null); setError(err instanceof Error ? err.message : "Unable to load bank cash flow."); }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
          setInitialLoad(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [startDate, endDate, groupBy, bankAccountId]);

  if (initialLoad) return <BrandLoader />;

  const periods = data?.periods ?? [];
  const totals = data?.totals ?? { inflows: 0n, outflows: 0n, net: 0n };
  const currency = data?.currencyCode ?? "USD";

  return (
    <ContentReveal className="space-y-6">
      <BackToReports />

      <PageHeader
        title="Money in and out of your bank accounts"
        description="Cash that actually moved through your bank accounts, period by period."
      >
        <ExportButton
          data={(loading || error ? [] : periods).map(p => ({ ...p, currencyCode: currency }))}
          columns={["label", "currencyCode", "inflows", "outflows", "net", "balance"]}
          filename="bank-cash-flow"
        />
      </PageHeader>

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

      <ReportHelp>
        Every penny that came into and went out of your bank accounts over the
        chosen dates, grouped into periods. &ldquo;Money in&rdquo; is deposits and
        receipts; &ldquo;money out&rdquo; is payments and withdrawals. The running
        balance shows how each period changed the cash on hand.
      </ReportHelp>

      <div className="flex flex-col gap-3 rounded-lg border bg-muted/20 p-3 sm:flex-row sm:flex-wrap sm:items-end sm:gap-4">
        <DateRangeFilter
          startDate={startDate}
          endDate={endDate}
          onDateChange={(s, e) => {
            setStartDate(s);
            setEndDate(e);
          }}
        />
        <div className="flex flex-col gap-1">
          <span className="text-[13px] text-muted-foreground">Bank account</span>
          <select
            value={bankAccountId}
            onChange={(e) => setBankAccountId(e.target.value)}
            className="h-9 rounded-md border bg-background px-2 text-sm"
          >
            <option value="">All bank accounts</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.accountName}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[13px] text-muted-foreground">Group</span>
          <select
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value)}
            className="h-9 rounded-md border bg-background px-2 text-sm"
          >
            {GROUP_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <BrandLoader className="h-48" />
      ) : error ? null : (
        <ContentReveal className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard
              title="Money in"
              value={formatMoney(totals.inflows, currency)}
              icon={ArrowDownToLine}
            />
            <StatCard
              title="Money out"
              value={formatMoney(analyticalAbs(totals.outflows), currency)}
              icon={ArrowUpFromLine}
            />
            <StatCard
              title="Net change"
              value={formatMoney(totals.net, currency)}
              icon={Wallet}
            />
          </div>

          <div className="rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Period</TableHead>
                  <TableHead className="w-32 text-right">Money in</TableHead>
                  <TableHead className="w-32 text-right">Money out</TableHead>
                  <TableHead className="w-32 text-right">Net change</TableHead>
                  <TableHead className="w-36 text-right">Cumulative net change</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {periods.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center text-sm text-muted-foreground py-8"
                    >
                      No bank movements in this date range.
                    </TableCell>
                  </TableRow>
                ) : (
                  periods.map((p) => (
                    <TableRow key={p.startDate}>
                      <TableCell className="font-medium text-sm">{p.label}</TableCell>
                      <TableCell className="text-right font-mono text-sm tabular-nums text-emerald-600">
                        {formatMoney(p.inflows, currency)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm tabular-nums text-rose-600">
                        {formatMoney(analyticalAbs(p.outflows), currency)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm tabular-nums">
                        {formatMoney(p.net, currency)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm tabular-nums">
                        {formatMoney(p.balance, currency)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
              {periods.length > 0 && (
                <TableBody>
                  <TableRow className="bg-muted/30 font-bold">
                    <TableCell>Total</TableCell>
                    <TableCell className="text-right font-mono text-sm tabular-nums">
                      {formatMoney(totals.inflows, currency)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm tabular-nums">
                      {formatMoney(analyticalAbs(totals.outflows), currency)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm tabular-nums">
                      {formatMoney(totals.net, currency)}
                    </TableCell>
                    <TableCell />
                  </TableRow>
                </TableBody>
              )}
            </Table>
          </div>
        </ContentReveal>
      )}
    </ContentReveal>
  );
}
