"use client";

import { BidiText, IdentifierText } from "@/components/ui/bidi-text";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { usePresentation } from "@/i18n/provider";
import { formatExactCurrencyDecimal, formatExactMoneyAfterAmount, type NumberPresentation } from "@/i18n/numbers";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  ArrowDownLeft,
  ArrowUpRight,
  Landmark,
  BookOpen,
  FileText,
  Users,
  AlertTriangle,
  Gauge,
  Rocket,
  CheckCircle2,
  ChevronRight,
  X,
} from "lucide-react";
import { GrainGradient } from "@paper-design/shaders-react";
import { StatCard } from "@/components/dashboard/stat-card";
import { DataTable, type Column } from "@/components/dashboard/data-table";
import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { coreJournalSummary, coreDebitDisplay, type DebitGroup } from "@/lib/money/core-presentation";
import { displayMoney, displayJson, displayPercent, dashboardAlertsUi, dashboardTrendsUi } from "@/lib/money/contact-dashboard-ui";
import { profitLossUi, type ProfitLossUi } from "@/lib/money/financial-statement-ui";
import { receivablesUi, payablesUi, type AgingUi } from "@/lib/money/ledger-aging-ui";
import { budgetUiPayload, budgetDecimal, budgetPercent } from "@/lib/money/budget-ui";
import { devDelay } from "@/lib/dev-delay";
import { BrandLoader } from "@/components/dashboard/brand-loader";
import { ErrorState } from "@/components/dashboard/error-state";
import { cn } from "@/lib/utils";
import { useCreateDrawer } from "@/components/dashboard/create-drawer";
import { CashFlowWidget } from "@/components/dashboard/cash-flow-widget";
import { useDocumentTitle } from "@/lib/hooks/use-document-title";

type GreetingKey = `morning${0 | 1 | 2 | 3}` | `afternoon${0 | 1 | 2}` | `evening${0 | 1 | 2}` | `anytime${0 | 1 | 2 | 3 | 4 | 5 | 6}` | `day${0 | 1 | 2 | 3 | 4 | 5 | 6}`;

function pickGreeting(): GreetingKey {
  const now = new Date();
  const hour = now.getHours();
  const timePool = hour >= 5 && hour < 12
    ? ["morning0", "morning1", "morning2", "morning3"]
    : hour >= 12 && hour < 17 ? ["afternoon0", "afternoon1", "afternoon2"]
    : ["evening0", "evening1", "evening2"];
  const options = [...timePool, ...Array.from({ length: 7 }, (_, i) => `anytime${i}`), `day${now.getDay()}`];
  return options[Math.floor(Math.random() * options.length)] as GreetingKey;
}

interface Entry {
  id: string;
  entryNumber: number;
  date: string;
  description: string;
  status: "draft" | "posted" | "void";
  totalDebit: string;
  totalDebitMinor: string;
  debitTotals: DebitGroup[];
}

type PnLData = Pick<ProfitLossUi, "totalRevenue" | "totalExpenses" | "netIncome" | "expenses" | "currencyCode">;
type AgingBucket = Pick<AgingUi["buckets"][number], "label" | "total" | "count">;
type AgingData = { buckets: AgingBucket[]; grandTotal: bigint; currencyCode: string };

function entryColumns(t: ReturnType<typeof useTranslations>, presentation: NumberPresentation): Column<Entry>[] {
  return [
  {
    key: "number",
    header: "#",
    className: "w-16",
    render: (r) => (
      <span className="font-mono text-xs text-muted-foreground"><IdentifierText>
        {r.entryNumber}
      </IdentifierText></span>
    ),
  },
  {
    key: "date",
    header: t("date"),
    className: "w-28",
    render: (r) => <span className="text-sm"><IdentifierText>{r.date}</IdentifierText></span>,
  },
  {
    key: "description",
    header: t("description"),
    render: (r) => <span className="text-sm font-medium"><BidiText>{r.description}</BidiText></span>,
  },
  {
    key: "status",
    header: t("status"),
    className: "w-24",
    render: (r) => (
      <Badge
        variant="outline"
        className={
          r.status === "posted"
            ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-400"
            : r.status === "void"
            ? "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400"
            : ""
        }
      >
        {t(`status_${r.status}`)}
      </Badge>
    ),
  },
  {
    key: "amount",
    header: t("amount"),
    className: "w-28 text-end",
    render: (r) => (
      <span className="font-mono text-sm tabular-nums"><IdentifierText>
        {coreDebitDisplay([r], presentation)}
      </IdentifierText></span>
    ),
  },
  ];
}

const BUCKET_COLORS = [
  "bg-emerald-500",
  "bg-amber-500",
  "bg-orange-500",
  "bg-red-400",
  "bg-red-600",
];

function AgingColumn({
  title,
  total,
  buckets,
  currencyCode,
}: {
  title: string;
  total: bigint;
  buckets: AgingBucket[];
  currencyCode: string;
}) {
  const t = useTranslations("DashboardOverview");
  const presentation = usePresentation();
  const formatMoney = (amount: bigint, code: string) =>
    code === "IRR" && presentation.locale === "fa-IR"
      ? formatExactMoneyAfterAmount(amount, code, presentation)
      : displayMoney(amount, code, presentation);
  const maxBucket = buckets.reduce((max, bucket) => bucket.total > max ? bucket.total : max, 1n);

  return (
    <div>
      <p className="text-sm font-medium"><BidiText>{title}</BidiText></p>
      <p className="mt-0.5 font-mono text-lg font-bold tabular-nums"><IdentifierText>
        {formatMoney(total, currencyCode)}
      </IdentifierText></p>
      <div className="mt-3 space-y-2">
        {buckets.map((bucket, i) => {
          const pct = displayPercent(bucket.total, maxBucket);
          return (
            <div key={bucket.label} className="space-y-1">
              <div className="flex flex-wrap items-center justify-between text-xs">
                <span className="text-muted-foreground">{t((["bucket0", "bucket1", "bucket2", "bucket3", "bucket4"] as const)[i])}</span>
                <span className="font-mono tabular-nums"><IdentifierText>
                  {formatMoney(bucket.total, currencyCode)}
                </IdentifierText></span>
              </div>
              <div className="h-1.5 rounded-full bg-muted">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    BUCKET_COLORS[i]
                  )}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function KpiItem({ label, value, good }: { label: string; value: string; good: boolean }) {
  return (
    <div className="text-center">
      <p className={cn(
        "text-lg font-bold font-mono tabular-nums",
        good ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
      )}><IdentifierText>
        {value}
      </IdentifierText></p>
      <p className="text-[11px] text-muted-foreground mt-0.5"><BidiText>{label}</BidiText></p>
    </div>
  );
}

export default function DashboardPage() {
  const t = useTranslations("DashboardOverview");
  const presentation = usePresentation();
  const formatMoney = (amount: bigint, code: string) =>
    code === "IRR" && presentation.locale === "fa-IR"
      ? formatExactMoneyAfterAmount(amount, code, presentation)
      : displayMoney(amount, code, presentation);
  // Budget reports retain their documented fixed-two scale, even for IRR/JPY.
  const budgetMoney = (amount: bigint, code: string) => formatExactCurrencyDecimal(budgetDecimal(amount), code, presentation);
  const columns = entryColumns(t, presentation);
  const router = useRouter();
  const { open: openDrawer } = useCreateDrawer();
  const { data: session } = useSession();
  const firstName = session?.user?.name?.split(" ")[0] || "";
  const [greeting] = useState(() => pickGreeting());
  const [entries, setEntries] = useState<Entry[]>([]);
  const [pnl, setPnl] = useState<PnLData>({
    totalRevenue: 0n,
    totalExpenses: 0n,
    netIncome: 0n,
    expenses: [],
    currencyCode: "USD",
  });
  const [receivables, setReceivables] = useState<AgingData>({
    buckets: [],
    currencyCode: "USD",
    grandTotal: 0n,
  });
  const [payables, setPayables] = useState<AgingData>({
    buckets: [],
    currencyCode: "USD",
    grandTotal: 0n,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<"loadError" | "reportError" | "alertError" | null>(null);
  const [sparklines, setSparklines] = useState<{
    revenue: number[];
    expenses: number[];
    netIncome: number[];
  }>({ revenue: [], expenses: [], netIncome: [] });
  const [budgetAlerts, setBudgetAlerts] = useState<
    { accountName: string; pct: number; budgeted: bigint; actual: bigint; currencyCode: string }[]
  >([]);
  const [ratios, setRatios] = useState<{
    currentRatio: number | null;
    quickRatio: number | null;
    grossMargin: number | null;
    netMargin: number | null;
    dso: number | null;
    dpo: number | null;
  } | null>(null);
  const [actionAlerts, setActionAlerts] = useState<ReturnType<typeof dashboardAlertsUi> | null>(null);
  // Getting-started checklist: show while the org has never completed onboarding.
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [dismissingOnboarding, setDismissingOnboarding] = useState(false);

  useDocumentTitle(t("documentTitle"));

  useEffect(() => {
    const id = localStorage.getItem("activeOrgId");
    const headers: Record<string, string> = {};
    if (id) headers["x-organization-id"] = id;

    Promise.all([
      fetch("/api/v1/entries?limit=10", { headers }).then((r) => r.json()),
      fetch("/api/v1/reports/profit-and-loss", { headers })
        .then((r) => displayJson(r, profitLossUi)),
      fetch("/api/v1/reports/aged-receivables", { headers })
        .then((r) => displayJson(r, receivablesUi)),
      fetch("/api/v1/reports/aged-payables", { headers })
        .then((r) => displayJson(r, payablesUi)),
    ])
      .then(([entriesData, pnlData, arData, apData]) => {
        if (entriesData.entries) {
          setEntries(entriesData.entries.map(coreJournalSummary));
        }
        setPnl(pnlData);
        if (arData?.buckets) setReceivables(arData);
        if (apData?.buckets) setPayables(apData);
      })
      .then(() => devDelay())
      .catch(() => setError("loadError"))
      .finally(() => setLoading(false));

    // Load sparkline trends in background
    fetch("/api/v1/reports/monthly-trends?months=6", { headers })
      .then((r) => displayJson(r, dashboardTrendsUi))
      .then((data) => {
        setSparklines(data);
      })
      .catch(() => setError("reportError"));

    // Load budget alerts in background
    fetch("/api/v1/reports/budget-vs-actual", { headers })
      .then((r) => displayJson(r, body => budgetUiPayload(body as { currencyCode: string; comparisons: { accountName: string; budgeted: number; actual: number; variance: number; budgetedMinor: string; actualMinor: string; varianceMinor: string }[]; totalBudgeted: number; totalActual: number; totalVariance: number; totalBurnRate: number })))
      .then((data) => {
        if (data.comparisons) {
          const alerts = data.comparisons
            .filter(
              (c) => c.budgeted > 0n && c.actual * 10n >= c.budgeted * 9n
            )
            .map((c) => ({
              accountName: c.accountName,
              pct: budgetPercent(c.actual, c.budgeted),
              currencyCode: data.currencyCode,
              budgeted: c.budgeted,
              actual: c.actual,
            }));
          setBudgetAlerts(alerts);
        }
      })
      .catch(() => setError("reportError"));

    // Load financial ratios in background
    fetch("/api/v1/reports/financial-ratios", { headers })
      .then((r) => r.json())
      .then((data) => {
        if (data.ratios) setRatios(data.ratios);
      })
      .catch(() => setError("reportError"));

    // Load action alerts in background
    fetch("/api/v1/dashboard/alerts", { headers })
      .then((r) => displayJson(r, dashboardAlertsUi))
      .then((data) => setActionAlerts(data))
      .catch(() => setError("alertError"));

    // Decide whether to show the getting-started checklist (org never onboarded).
    fetch("/api/v1/organization", { headers })
      .then((r) => r.json())
      .then((data) => {
        if (data?.organization && !data.organization.onboardingCompletedAt) {
          setShowOnboarding(true);
        }
      })
      .catch(() => {});

  }, []);

  const dismissOnboarding = () => {
    setDismissingOnboarding(true);
    const id = localStorage.getItem("activeOrgId");
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (id) headers["x-organization-id"] = id;
    fetch("/api/v1/organization", {
      method: "PATCH",
      headers,
      body: JSON.stringify({ onboardingCompleted: true }),
    })
      .then(() => setShowOnboarding(false))
      .catch(() => {})
      .finally(() => setDismissingOnboarding(false));
  };

  const receivablesCount = receivables.buckets.reduce(
    (sum, b) => sum + b.count,
    0
  );
  const payablesCount = payables.buckets.reduce(
    (sum, b) => sum + b.count,
    0
  );

  const maxRevExp = [pnl.totalRevenue, pnl.totalExpenses].reduce((max, amount) => amount > max ? amount : max, 1n);
  const revenuePct = displayPercent(pnl.totalRevenue, maxRevExp);
  const expensesPct = displayPercent(pnl.totalExpenses, maxRevExp);

  const topExpenses = [...pnl.expenses]
    .sort((a, b) => a.balance === b.balance ? 0 : a.balance > b.balance ? -1 : 1)
    .slice(0, 4);

  return (
    <MotionConfig reducedMotion="never">
      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div
            key="loader"
            initial={{ opacity: 1 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, filter: "blur(6px)" }}
            transition={{ duration: 0.25, ease: "easeOut" }}
          >
            <BrandLoader />
          </motion.div>
        ) : error ? (
          <motion.div
            key="error"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <ErrorState message={t(error)} onRetry={() => window.location.reload()} />
          </motion.div>
        ) : (
          <motion.div
            key="content"
            initial={{ opacity: 0, y: 12, filter: "blur(10px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ duration: 0.8, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
            className="space-y-6"
          >
            {/* Section A: Greeting Banner */}
            <div className="relative overflow-hidden rounded-2xl">
              <GrainGradient
                className="pointer-events-none !absolute !inset-0 !rounded-none"
                width="100%"
                height="100%"
                colors={[
                  "#d1fae5",
                  "#a7f3d0",
                  "#6ee7b7",
                  "#34d399",
                  "#10b981",
                  "#34d399",
                  "#a7f3d0",
                ]}
                colorBack="#34d399"
                softness={1}
                intensity={0.8}
                noise={0.9}
                shape="wave"
                scale={3.5}
                speed={0.2}
              />
              <div className="relative p-5 sm:p-8">
                <h2 className="text-xl sm:text-2xl font-bold text-emerald-950"><BidiText>
                  {firstName ? t.rich("greetingWithName", { greeting: t(greeting), name: firstName, code: (chunks) => <BidiText>{chunks}</BidiText> }) : t(greeting)}
                </BidiText></h2>
                <p className="mt-1 max-w-lg text-sm text-emerald-950/70">
                  {t("overviewHelp")}
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    className="bg-emerald-950 text-white hover:bg-emerald-900 h-auto min-h-8 max-w-full whitespace-normal [overflow-wrap:anywhere]"
                    onClick={() => router.push("/accounting/accounts")}
                  >
                    <Landmark className="me-1.5 size-3.5" />
                    {t("accounts")}
                  </Button>
                  <Button
                    size="sm"
                    className="bg-emerald-950/10 text-emerald-950 hover:bg-emerald-950/20 border-0 h-auto min-h-8 max-w-full whitespace-normal [overflow-wrap:anywhere]"
                    onClick={() => openDrawer("entry")}
                  >
                    <BookOpen className="me-1.5 size-3.5" />
                    {t("newEntry")}
                  </Button>
                  <Button
                    size="sm"
                    className="bg-emerald-950/10 text-emerald-950 hover:bg-emerald-950/20 border-0 h-auto min-h-8 max-w-full whitespace-normal [overflow-wrap:anywhere]"
                    onClick={() => openDrawer("invoice")}
                  >
                    <FileText className="me-1.5 size-3.5" />
                    {t("newInvoice")}
                  </Button>
                  <Button
                    size="sm"
                    className="bg-emerald-950/10 text-emerald-950 hover:bg-emerald-950/20 border-0 h-auto min-h-8 max-w-full whitespace-normal [overflow-wrap:anywhere]"
                    onClick={() => router.push("/contacts")}
                  >
                    <Users className="me-1.5 size-3.5" />
                    {t("contacts")}
                  </Button>
                </div>
              </div>
            </div>

            {/* Getting started checklist */}
            {showOnboarding && (
              <div className="relative rounded-lg border bg-card p-5">
                <button
                  onClick={dismissOnboarding}
                  disabled={dismissingOnboarding}
                  aria-label={t("dismissGettingStarted")}
                  className="absolute end-3 top-3 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
                >
                  <X className="size-4" />
                </button>
                <div className="flex items-center gap-2">
                  <Rocket className="size-4 text-emerald-600" />
                  <h3 className="text-sm font-semibold">{t("gettingStarted")}</h3>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t("setupHelp")}
                </p>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {[
                    {
                      label: t("addBank"),
                      desc: t("addBankHelp"),
                      href: "/accounting/banking",
                    },
                    {
                      label: t("opening"),
                      desc: t("openingHelp"),
                      href: "/accounting/opening-balances",
                    },
                    {
                      label: t("tax"),
                      desc: t("taxHelp"),
                      href: "/tax",
                    },
                    {
                      label: t("firstInvoice"),
                      desc: t("firstInvoiceHelp"),
                      href: "/sales",
                    },
                  ].map((step) => (
                    <button
                      key={step.href}
                      onClick={() => router.push(step.href)}
                      className="flex items-start gap-3 rounded-lg border bg-background p-3 text-start transition-colors hover:border-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                    >
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-muted-foreground/40" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium"><BidiText>{step.label}</BidiText></p>
                        <p className="text-xs text-muted-foreground"><BidiText>{step.desc}</BidiText></p>
                      </div>
                      <ChevronRight className="mt-0.5 size-4 shrink-0 text-muted-foreground/40 [&:dir(rtl)]:rotate-180" />
                    </button>
                  ))}
                </div>
                <div className="mt-4 flex justify-end">
                  <Button className="h-auto min-h-8 max-w-full whitespace-normal [overflow-wrap:anywhere]"
                    variant="outline"
                    size="sm"
                    onClick={dismissOnboarding}
                    disabled={dismissingOnboarding}
                  >
                    {dismissingOnboarding ? t("saving") : t("dismiss")}
                  </Button>
                </div>
              </div>
            )}

            {/* Budget Alerts */}
            {budgetAlerts.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="size-4 text-amber-600" />
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                    {t("budgetAlerts")}
                  </p>
                </div>
                <div className="space-y-1">
                  {budgetAlerts.slice(0, 3).map((alert) => (
                    <div
                      key={alert.accountName}
                      className="flex flex-wrap items-center justify-between text-xs"
                    >
                      <span className="text-amber-700 dark:text-amber-400"><BidiText>
                        {alert.accountName}
                      </BidiText></span>
                      <span
                        className={cn(
                          "font-mono tabular-nums font-medium",
                          alert.pct >= 100
                            ? "text-red-600"
                            : "text-amber-700 dark:text-amber-400"
                        )}
                      >
                        {t.rich("budgetUsed", { percent: String(alert.pct), actual: budgetMoney(alert.actual, alert.currencyCode), budget: budgetMoney(alert.budgeted, alert.currencyCode), code: (chunks) => <IdentifierText>{chunks}</IdentifierText> })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Section B: Stat Cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              <StatCard
                title={t("revenue")}
                value={formatMoney(pnl.totalRevenue, pnl.currencyCode)}
                icon={TrendingUp}
                sparklineData={sparklines.revenue.length > 1 ? sparklines.revenue : undefined}
              />
              <StatCard
                title={t("expenses")}
                value={formatMoney(pnl.totalExpenses, pnl.currencyCode)}
                icon={TrendingDown}
                sparklineData={sparklines.expenses.length > 1 ? sparklines.expenses : undefined}
              />
              <StatCard
                title={t("netIncome")}
                value={formatMoney(pnl.netIncome, pnl.currencyCode)}
                icon={DollarSign}
                changeType={pnl.netIncome >= 0 ? "positive" : "negative"}
                sparklineData={sparklines.netIncome.length > 1 ? sparklines.netIncome : undefined}
              />
              <StatCard
                title={t("receivables")}
                value={formatMoney(receivables.grandTotal, receivables.currencyCode)}
                icon={ArrowDownLeft}
                change={t("outstandingCount", { count: receivablesCount })}
                changeType="neutral"
              />
              <StatCard
                title={t("payables")}
                value={formatMoney(payables.grandTotal, payables.currencyCode)}
                icon={ArrowUpRight}
                change={t("outstandingCount", { count: payablesCount })}
                changeType="neutral"
              />
            </div>

            {/* Section C: Financial Health */}
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Revenue vs Expenses */}
              <div className="rounded-lg border bg-card p-5">
                <h3 className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground">
                  {t("revenueExpenses")}
                </h3>
                <div className="mt-4 space-y-3">
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center justify-between text-sm">
                      <span className="text-muted-foreground">{t("revenue")}</span>
                      <span className="font-mono text-sm tabular-nums font-medium"><IdentifierText>
                        {formatMoney(pnl.totalRevenue, pnl.currencyCode)}
                      </IdentifierText></span>
                    </div>
                    <div className="h-2 rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-emerald-500 transition-all"
                        style={{ width: `${revenuePct}%` }}
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center justify-between text-sm">
                      <span className="text-muted-foreground">{t("expenses")}</span>
                      <span className="font-mono text-sm tabular-nums font-medium"><IdentifierText>
                        {formatMoney(pnl.totalExpenses, pnl.currencyCode)}
                      </IdentifierText></span>
                    </div>
                    <div className="h-2 rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-red-500 transition-all"
                        style={{ width: `${expensesPct}%` }}
                      />
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-between border-t pt-3">
                    <span className="text-sm text-muted-foreground">
                      {t("netIncome")}
                    </span>
                    <span
                      className={cn(
                        "font-mono text-sm tabular-nums font-semibold",
                        pnl.netIncome >= 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-red-600 dark:text-red-400"
                      )}
                    ><IdentifierText>
                      {formatMoney(pnl.netIncome, pnl.currencyCode)}
                    </IdentifierText></span>
                  </div>
                </div>
                {topExpenses.length > 0 && (
                  <div className="mt-4 border-t pt-4">
                    <p className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground mb-2">
                      {t("topExpenses")}
                    </p>
                    <div className="space-y-2">
                      {topExpenses.map((exp) => (
                        <div
                          key={exp.accountName}
                          className="flex flex-wrap items-center justify-between text-sm"
                        >
                          <span className="min-w-0 whitespace-normal [overflow-wrap:anywhere] text-muted-foreground"><BidiText>
                            {exp.accountName}
                          </BidiText></span>
                          <span className="ms-2 shrink-0 font-mono text-xs tabular-nums"><IdentifierText>
                            {formatMoney(exp.balance, pnl.currencyCode)}
                          </IdentifierText></span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Aging Summary */}
              <div className="rounded-lg border bg-card p-5">
                <h3 className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground">
                  {t("aging")}
                </h3>
                <div className="mt-4 grid grid-cols-2 gap-6">
                  <AgingColumn
                    title={t("receivables")}
                    total={receivables.grandTotal}
                    buckets={receivables.buckets}
                    currencyCode={receivables.currencyCode}
                  />
                  <AgingColumn
                    title={t("payables")}
                    total={payables.grandTotal}
                    buckets={payables.buckets}
                    currencyCode={payables.currencyCode}
                  />
                </div>
              </div>
            </div>

            {/* Cash Flow Forecast */}
            <CashFlowWidget />

            {/* Financial KPIs */}
            {ratios && Object.values(ratios).some((v) => v !== null) && (
              <div className="rounded-lg border bg-card p-5">
                <div className="flex flex-wrap items-center justify-between mb-4">
                  <h3 className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground">
                    {t("kpis")}
                  </h3>
                  <Gauge className="size-4 text-muted-foreground/50" />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                  {ratios.currentRatio !== null && (
                    <KpiItem label={t("currentRatio")} value={`${ratios.currentRatio}x`} good={ratios.currentRatio >= 1} />
                  )}
                  {ratios.quickRatio !== null && (
                    <KpiItem label={t("quickRatio")} value={`${ratios.quickRatio}x`} good={ratios.quickRatio >= 1} />
                  )}
                  {ratios.grossMargin !== null && (
                    <KpiItem label={t("grossMargin")} value={`${ratios.grossMargin}%`} good={ratios.grossMargin > 0} />
                  )}
                  {ratios.netMargin !== null && (
                    <KpiItem label={t("netMargin")} value={`${ratios.netMargin}%`} good={ratios.netMargin > 0} />
                  )}
                  {ratios.dso !== null && (
                    <KpiItem label={t("dso")} value={t("days", { count: ratios.dso })} good={ratios.dso <= 45} />
                  )}
                  {ratios.dpo !== null && (
                    <KpiItem label={t("dpo")} value={t("days", { count: ratios.dpo })} good={ratios.dpo <= 60} />
                  )}
                </div>
              </div>
            )}

            {/* Quick Actions */}
            {actionAlerts && (actionAlerts.overdueInvoices?.count > 0 || actionAlerts.overdueBills?.count > 0 || actionAlerts.uncategorizedTransactions > 0 || (actionAlerts.accountsNeedingReconciliation?.length ?? 0) > 0) && (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {actionAlerts.overdueInvoices?.count > 0 && (
                  <button
                    onClick={() => router.push("/sales")}
                    className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-3 text-start transition-colors hover:bg-red-100 dark:hover:bg-red-950/50"
                  >
                    <p className="text-xs font-medium text-red-800 dark:text-red-300">{t("overdueInvoices")}</p>
                    <p className="text-lg font-bold font-mono tabular-nums text-red-600 mt-0.5">{actionAlerts.overdueInvoices.count}</p>
                    <p className="text-[11px] text-red-600/70 font-mono tabular-nums">{t.rich("outstandingMoney", { amount: formatMoney(actionAlerts.overdueInvoices.total, actionAlerts.overdueInvoices.currencyCode), code: (chunks) => <IdentifierText>{chunks}</IdentifierText> })}</p>
                  </button>
                )}
                {actionAlerts.overdueBills?.count > 0 && (
                  <button
                    onClick={() => router.push("/purchases")}
                    className="rounded-lg border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/30 p-3 text-start transition-colors hover:bg-orange-100 dark:hover:bg-orange-950/50"
                  >
                    <p className="text-xs font-medium text-orange-800 dark:text-orange-300">{t("overdueBills")}</p>
                    <p className="text-lg font-bold font-mono tabular-nums text-orange-600 mt-0.5">{actionAlerts.overdueBills.count}</p>
                    <p className="text-[11px] text-orange-600/70 font-mono tabular-nums">{t.rich("toPayMoney", { amount: formatMoney(actionAlerts.overdueBills.total, actionAlerts.overdueBills.currencyCode), code: (chunks) => <IdentifierText>{chunks}</IdentifierText> })}</p>
                  </button>
                )}
                {actionAlerts.uncategorizedTransactions > 0 && (
                  <button
                    onClick={() => router.push("/accounting/banking")}
                    className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 p-3 text-start transition-colors hover:bg-blue-100 dark:hover:bg-blue-950/50"
                  >
                    <p className="text-xs font-medium text-blue-800 dark:text-blue-300">{t("uncategorized")}</p>
                    <p className="text-lg font-bold font-mono tabular-nums text-blue-600 mt-0.5">{actionAlerts.uncategorizedTransactions}</p>
                    <p className="text-[11px] text-blue-600/70">{t("needCategorization")}</p>
                  </button>
                )}
                {actionAlerts.accountsNeedingReconciliation?.length > 0 && (
                  <button
                    onClick={() => router.push("/accounting/banking")}
                    className="rounded-lg border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-950/30 p-3 text-start transition-colors hover:bg-violet-100 dark:hover:bg-violet-950/50"
                  >
                    <p className="text-xs font-medium text-violet-800 dark:text-violet-300">{t("needsReconciliation")}</p>
                    <p className="text-lg font-bold font-mono tabular-nums text-violet-600 mt-0.5">{actionAlerts.accountsNeedingReconciliation.length}</p>
                    <p className="text-[11px] text-violet-600/70">{t("bankAccounts", { count: actionAlerts.accountsNeedingReconciliation.length })}</p>
                  </button>
                )}
              </div>
            )}

            {/* Section D: Recent Activity */}
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between">
                  <h2 className="text-[13px] font-semibold">{t("recentEntries")}</h2>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-muted-foreground h-auto min-h-8 max-w-full whitespace-normal [overflow-wrap:anywhere]"
                    onClick={() => router.push("/accounting")}
                  >
                    {t("viewAll")}
                  </Button>
                </div>
                <DataTable
                  columns={columns}
                  data={entries}
                  loading={loading}
                  emptyMessage={t("noEntries")}
                  emptyAction={{
                    label: t("firstEntry"),
                    onClick: () => openDrawer("entry"),
                  }}
                  onRowClick={(r) => router.push(`/accounting/${r.id}`)}
                />
              </div>
              <div>
                <ActivityFeed />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </MotionConfig>
  );
}
