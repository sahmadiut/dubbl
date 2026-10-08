"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { ArrowLeft, TrendingUp, TrendingDown, DollarSign } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { BrandLoader } from "@/components/dashboard/brand-loader";
import { ContentReveal } from "@/components/ui/content-reveal";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { statementMoneyText } from "@/lib/reports/statement-money";
import { money, toMajorDecimal } from "@/lib/money/exact";
import { CurrencySelect } from "@/components/ui/currency-select";
import { cn } from "@/lib/utils";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from "recharts";

interface ForecastWeek {
  weekOf: string;
  inflows: number;
  outflows: number;
  net: number;
  cumulativeNet: number;
  entryCount: number;
}

export default function CashFlowForecastPage() {
  const [initialLoad, setInitialLoad] = useState(true);
  const [loading, setLoading] = useState(true);
  const [currencyCode, setCurrencyCode] = useState("USD");
  const [currencyFilter, setCurrencyFilter] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [weeksAhead, setWeeksAhead] = useState(12);
  const [weeks, setWeeks] = useState<ForecastWeek[]>([]);
  const [totalInflows, setTotalInflows] = useState(0);
  const [totalOutflows, setTotalOutflows] = useState(0);
  const [netForecast, setNetForecast] = useState(0);

  useEffect(() => {
    const orgId = localStorage.getItem("activeOrgId");
    if (!orgId) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    const params = new URLSearchParams({ weeks: String(weeksAhead) });
    if (currencyFilter) params.set("currencyCode", currencyFilter);
    fetch(`/api/v1/reports/cash-flow-forecast?${params}`, {
      headers: { "x-organization-id": orgId },
    })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || "Unable to load cash forecast.");
        return data;
      })
      .then((data) => {
        if (cancelled) return;
        setError(null);
        setCurrencyCode(data.currencyCode);
        setWeeks(data.weeks || []);
        setTotalInflows(data.totalInflows || 0);
        setTotalOutflows(data.totalOutflows || 0);
        setNetForecast(data.netForecast || 0);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Unable to load cash forecast.");
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
          setInitialLoad(false);
        }
      });
    return () => { cancelled = true; };
  }, [weeksAhead, currencyFilter]);

  const chartData = weeks.map((w) => ({
    name: w.weekOf,
    inflows: Number(toMajorDecimal(money(BigInt(w.inflows), currencyCode))),
    outflows: Number(toMajorDecimal(money(BigInt(w.outflows), currencyCode))),
    minor: w,
    cumulative: Number(toMajorDecimal(money(BigInt(w.cumulativeNet), currencyCode))),
  }));

  if (initialLoad) return <BrandLoader />;

  return (
    <ContentReveal className="space-y-6">
      <Link href="/reports" className="flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="size-3.5" /> Back to reports
      </Link>

      <PageHeader
        title="Cash coming up"
        description="A forward look at money expected in and out, from invoices, bills, and repeating items."
      />

      <div className="flex items-center gap-3">
        <Select value={String(weeksAhead)} onValueChange={(v) => setWeeksAhead(Number(v))}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="4">4 weeks</SelectItem>
            <SelectItem value="8">8 weeks</SelectItem>
            <SelectItem value="12">12 weeks</SelectItem>
            <SelectItem value="26">26 weeks</SelectItem>
            <SelectItem value="52">52 weeks</SelectItem>
          </SelectContent>
        </Select>
        <CurrencySelect value={currencyFilter} onValueChange={setCurrencyFilter} className="w-[220px]" />
        {currencyFilter && <button type="button" className="text-sm underline" onClick={() => setCurrencyFilter("")}>Clear filter</button>}
      </div>
      <p className="text-sm text-muted-foreground">Recurring estimates use line subtotals before tax and discounts. Partial weeks are included.</p>

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

      {!error && <>
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          title="Money expected in"
          value={statementMoneyText(totalInflows, currencyCode)}
          icon={TrendingUp}
          changeType="positive"
        />
        <StatCard
          title="Money expected out"
          value={statementMoneyText(totalOutflows, currencyCode)}
          icon={TrendingDown}
          changeType="negative"
        />
        <StatCard
          title="Expected change in cash"
          value={statementMoneyText(netForecast, currencyCode)}
          icon={DollarSign}
          changeType={netForecast >= 0 ? "positive" : "negative"}
        />
      </div>

      {loading ? (
        <BrandLoader className="h-48" />
      ) : weeks.length === 0 ? (
        <ContentReveal>
          <div className="rounded-xl border border-dashed py-12 text-center">
            <p className="text-sm text-muted-foreground">No forecast data available. Create invoices, bills, or recurring templates to see projections.</p>
          </div>
        </ContentReveal>
      ) : (
        <ContentReveal>
          {/* Cumulative Net Chart */}
          <div className="space-y-6">
            <div>
              <p className="text-sm font-medium mb-3">Cumulative Cash Flow</p>
              <div className="rounded-lg border p-4">
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                    <defs>
                      <linearGradient id="cumGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} className="text-muted-foreground" />
                    <YAxis tick={{ fontSize: 11 }} className="text-muted-foreground" tickFormatter={(v) => `${currencyCode} ${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`} />
                    <Tooltip
                      contentStyle={{ fontSize: 12, borderRadius: 8 }}
                      formatter={(_value, name, item) => {
                        const minor = item.payload?.minor as ForecastWeek | undefined;
                        const value = name === "Inflows" ? minor?.inflows : name === "Outflows" ? minor?.outflows : minor?.cumulativeNet;
                        return [value === undefined ? "" : statementMoneyText(value, currencyCode), name];
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="3 3" />
                    <Area type="monotone" dataKey="inflows" name="Inflows" stroke="#10b981" fill="none" strokeWidth={1.5} />
                    <Area type="monotone" dataKey="outflows" name="Outflows" stroke="#ef4444" fill="none" strokeWidth={1.5} />
                    <Area type="monotone" dataKey="cumulative" name="Cumulative Net" stroke="#3b82f6" fill="url(#cumGrad)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Weekly Breakdown Table */}
            <div>
              <p className="text-sm font-medium mb-3">Weekly Breakdown</p>
              <div className="rounded-lg border overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Week Of</th>
                      <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Inflows</th>
                      <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Outflows</th>
                      <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Net</th>
                      <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Cumulative</th>
                    </tr>
                  </thead>
                  <tbody>
                    {weeks.map((w) => (
                      <tr key={w.weekOf} className="border-b last:border-b-0">
                        <td className="px-4 py-2">{w.weekOf}</td>
                        <td className="px-4 py-2 text-right font-mono tabular-nums text-emerald-600">
                          {w.inflows > 0 ? statementMoneyText(w.inflows, currencyCode) : "-"}
                        </td>
                        <td className="px-4 py-2 text-right font-mono tabular-nums text-red-600">
                          {w.outflows > 0 ? statementMoneyText(w.outflows, currencyCode) : "-"}
                        </td>
                        <td className={cn(
                          "px-4 py-2 text-right font-mono tabular-nums font-medium",
                          w.net >= 0 ? "text-emerald-600" : "text-red-600"
                        )}>
                          {statementMoneyText(w.net, currencyCode)}
                        </td>
                        <td className={cn(
                          "px-4 py-2 text-right font-mono tabular-nums",
                          w.cumulativeNet >= 0 ? "text-blue-600" : "text-red-600"
                        )}>
                          {statementMoneyText(w.cumulativeNet, currencyCode)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </ContentReveal>
      )}
      </>}
    </ContentReveal>
  );
}
