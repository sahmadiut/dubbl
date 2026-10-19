"use client";
import { useTranslations } from "next-intl";
import { expenseStatusLabel, expenseSortLabel, type ExpenseTranslator, type ExpenseErrorKey } from "@/i18n/expense-presentation";


import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useDebounce } from "@/lib/hooks/use-debounce";
import { useRouter } from "next/navigation";
import { Plus, Receipt, Search, X, Loader2 } from "lucide-react";
import { useCreateDrawer } from "@/components/dashboard/create-drawer";
import { useDocumentTitle } from "@/lib/hooks/use-document-title";
import { PageHeader } from "@/components/dashboard/page-header";
import { DataTable, type Column } from "@/components/dashboard/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { expenseUiHeader, expenseUiCounts, expenseUiMinor, expenseUiMoney } from "@/lib/money/expense-ui";
import { expenseSummaryDisplay } from "@/lib/money/expense-display";
import { BrandLoader } from "@/components/dashboard/brand-loader";
import { ContentReveal } from "@/components/ui/content-reveal";
import { motion, MotionConfig } from "motion/react";

interface ExpenseClaim {
  id: string;
  title: string;
  status: string;
  totalAmount: number;
  currencyCode: string;
  createdAt: string;
  submittedAt: string | null;
  submittedByUser: { name: string | null; email: string } | null;
}

const statusColors: Record<string, string> = {
  draft: "",
  submitted:
    "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300",
  approved:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  rejected:
    "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300",
  paid: "border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-800 dark:bg-purple-950 dark:text-purple-300",
};

function buildColumns(t: ExpenseTranslator): Column<ExpenseClaim>[] {
  return [
    {
      key: "title",
      header: t("columnTitle"),
      sortKey: "title",
      render: (r) => <span className="text-sm font-medium">{r.title}</span>,
    },
    {
      key: "submittedBy",
      header: t("submittedBy"),
      render: (r) => (
        <span className="text-sm">
          {r.submittedByUser?.name || r.submittedByUser?.email || "-"}
        </span>
      ),
    },
    {
      key: "date",
      header: t("date"),
      sortKey: "date",
      className: "w-28",
      render: (r) => (
        <span className="text-sm">
          {new Date(r.createdAt).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: "status",
      header: t("status"),
      className: "w-28",
      render: (r) => (
        <Badge variant="outline" className={statusColors[r.status] || ""}>
          {expenseStatusLabel(t, r.status)}
        </Badge>
      ),
    },
    {
      key: "total",
      header: t("amount"),
      sortKey: "total",
      className: "w-28 text-right",
      render: (r) => (
        <span className="font-mono text-sm tabular-nums">
          {expenseUiMoney(expenseUiMinor(r, "totalAmount"), r.currencyCode)}
        </span>
      ),
    },
  ];
}

export default function ExpensesPage() {
  const orgId = typeof window !== "undefined" ? localStorage.getItem("activeOrgId") : null;
  return <ExpensesWorkspace key={orgId} />;
}

function ExpensesWorkspace() {
  const t = useTranslations("Expenses");
  const router = useRouter();
  const { open: openDrawer } = useCreateDrawer();
  const [claims, setClaims] = useState<ExpenseClaim[]>([]);
  const [countsData, setCountsData] = useState<{ counts: Record<string, { count: number; amount: number; amountMinor: string; currencyCode: string }>; total: number } | null>(null);
  const [countsError, setCountsError] = useState<ExpenseErrorKey | null>(null);
  const [claimsError, setClaimsError] = useState<ExpenseErrorKey | null>(null);
  const [loading, setLoading] = useState(true);
  const [refetching, setRefetching] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search);
  const [sortBy, setSortBy] = useState("created");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [fetchKey, setFetchKey] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const orgId = typeof window !== "undefined" ? localStorage.getItem("activeOrgId") : null;

  useDocumentTitle(t("documentTitle"));

  const columns = useMemo(() => buildColumns(t), [t]);

  const buildParams = useCallback((pg: number) => {
    const params = new URLSearchParams();
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (sortBy !== "created") params.set("sortBy", sortBy);
    if (sortOrder !== "desc") params.set("sortOrder", sortOrder);
    if (dateFrom) params.set("from", dateFrom);
    if (dateTo) params.set("to", dateTo);
    params.set("page", String(pg));
    params.set("limit", "50");
    return params;
  }, [statusFilter, debouncedSearch, sortBy, sortOrder, dateFrom, dateTo]);

  // Fetch status counts via lightweight COUNT(*) endpoint
  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;
    fetch(`/api/v1/expenses/counts`, {
      headers: { "x-organization-id": orgId },
    })
      .then(async (r) => { const data = await r.json(); if (!r.ok) throw new Error(data.error || "Unable to load expense totals"); return data; })
      .then((data) => {
        if (!cancelled) { setCountsData(expenseUiCounts(data)); setCountsError(null); }
      })
      .catch(() => { if (!cancelled) { setCountsData(null); setCountsError("countsFailed"); } });
    return () => { cancelled = true; };
  }, [orgId]);

  // Reset and fetch page 1 when filters change
  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;
    const isRefetch = !loading;

    setPage(1);
    setHasMore(true);
    if (isRefetch) setRefetching(true);

    fetch(`/api/v1/expenses?${buildParams(1)}`, {
      headers: { "x-organization-id": orgId },
    })
      .then(async (r) => { const data = await r.json(); if (!r.ok) throw new Error(data.error || "Unable to load expense claims"); return data; })
      .then((data) => {
        if (cancelled) return;
        setClaimsError(null);
        if (!Array.isArray(data.data)) throw new Error("Invalid expense list");
        setClaims(data.data.map(expenseUiHeader));
        if (data.pagination) {

          setHasMore(data.pagination.page < data.pagination.totalPages);
        }
      })
      .catch(() => { if (!cancelled) { setClaims([]); setClaimsError("readFailed"); setHasMore(false); } })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
          setRefetching(false);
          setFetchKey((k) => k + 1);
        }
      });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, statusFilter, debouncedSearch, sortBy, sortOrder, dateFrom, dateTo]);

  // Load next page
  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore || !orgId) return;
    const nextPage = page + 1;
    setLoadingMore(true);

    fetch(`/api/v1/expenses?${buildParams(nextPage)}`, {
      headers: { "x-organization-id": orgId },
    })
      .then(async (r) => { const data = await r.json(); if (!r.ok) throw new Error(data.error || "Unable to load more expense claims"); return data; })
      .then((data) => {
        setClaimsError(null);
        if (!Array.isArray(data.data)) throw new Error("Invalid expense list");
        const adopted = data.data.map(expenseUiHeader); setClaims((prev) => [...prev, ...adopted]);
        if (data.pagination) {
          setPage(data.pagination.page);

          setHasMore(data.pagination.page < data.pagination.totalPages);
        }
      })
      .catch(() => { setClaimsError("moreFailed"); setHasMore(false); })
      .finally(() => setLoadingMore(false));
  }, [loadingMore, hasMore, orgId, page, buildParams]);

  // IntersectionObserver for infinite scroll
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) loadMore(); },
      { rootMargin: "200px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore]);

  const handleSort = useCallback((key: string) => {
    setSortBy((prev) => {
      if (prev === key) {
        setSortOrder((o) => (o === "desc" ? "asc" : "desc"));
        return key;
      }
      setSortOrder("desc");
      return key;
    });
  }, []);

  const pendingSearch = search !== debouncedSearch;
  const hasFilters = dateFrom || dateTo;

  const statusCounts = useMemo(() => {
    if (!countsData) return {} as Record<string, number>;
    const c: Record<string, number> = {};
    for (const [status, data] of Object.entries(countsData.counts)) {
      c[status] = data.count;
    }
    return c;
  }, [countsData]);

  const summaryDisplay = (buckets: Parameters<typeof expenseSummaryDisplay>[0]) => new Set(buckets.map(row => row.currencyCode)).size > 1 ? t("multipleCurrencies") : expenseSummaryDisplay(buckets);

  const totalAmount = countsData ? summaryDisplay(Object.values(countsData.counts)) : "\u2014";
  const pending = countsData?.counts.submitted;
  const approved = countsData?.counts.approved;
  const pendingAmount = countsData ? summaryDisplay(pending ? [pending] : []) : "\u2014";
  const approvedAmount = countsData ? summaryDisplay(approved ? [approved] : []) : "\u2014";

  if (loading) return <BrandLoader />;

  if (!loading && !countsError && !claimsError && countsData?.total === 0 && statusFilter === "all" && !debouncedSearch && !hasFilters) {
    return (
      <ContentReveal>
        <div>
          {/* Full-width pipeline steps */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-0 rounded-lg border overflow-hidden mb-8">
            {[
              { label: t("draft"), desc: t("draftStep"), color: "bg-gray-400", bg: "bg-gray-50 dark:bg-gray-900/30" },
              { label: t("submitted"), desc: t("submittedStep"), color: "bg-blue-500", bg: "bg-blue-50 dark:bg-blue-900/20" },
              { label: t("approved"), desc: t("approvedStep"), color: "bg-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-900/20" },
              { label: t("paid"), desc: t("paidStep"), color: "bg-purple-500", bg: "bg-purple-50 dark:bg-purple-900/20" },
            ].map(({ label, desc, color, bg }, i) => (
              <div key={label} className={`relative flex flex-col items-center py-6 px-3 text-center border-r last:border-r-0 ${bg}`}>
                <div className={`absolute top-0 left-0 right-0 h-1 ${color} opacity-30`} />
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-bold text-muted-foreground/50 tabular-nums">{i + 1}</span>
                  <div className={`size-2.5 rounded-full ${color}`} />
                </div>
                <p className="text-sm font-medium">{label}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{desc}</p>
              </div>
            ))}
          </div>

          {/* Skeleton table background with overlay */}
          <div className="relative">
            <div className="pointer-events-none w-full rounded-lg border overflow-hidden">
              <div className="flex items-center gap-4 border-b bg-muted/50 px-4 h-10">
                <div className="h-2 w-28 rounded bg-muted-foreground/20" />
                <div className="h-2 w-20 rounded bg-muted-foreground/20" />
                <div className="h-2 w-16 rounded bg-muted-foreground/20 hidden sm:block" />
                <div className="ml-auto h-2 w-16 rounded bg-muted-foreground/20" />
                <div className="h-2 w-16 rounded bg-muted-foreground/20" />
              </div>
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 border-b last:border-0 px-4 h-12">
                  <div className={`h-2.5 rounded bg-muted flex-1 max-w-[200px] ${i % 2 === 0 ? "max-w-[180px]" : "max-w-[220px]"}`} />
                  <div className={`h-2.5 rounded bg-muted/60 ${i % 2 === 0 ? "w-24" : "w-20"} hidden sm:block`} />
                  <div className="h-2.5 w-20 rounded bg-muted/50 hidden sm:block" />
                  <div className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[10px] font-medium hidden sm:block ${
                    i % 3 === 0 ? "bg-blue-100 text-blue-400 dark:bg-blue-900/40 dark:text-blue-500" :
                    i % 3 === 1 ? "bg-emerald-100 text-emerald-400 dark:bg-emerald-900/40 dark:text-emerald-500" :
                    "bg-purple-100 text-purple-400 dark:bg-purple-900/40 dark:text-purple-500"
                  }`}>
                    {expenseStatusLabel(t, i % 3 === 0 ? "submitted" : i % 3 === 1 ? "approved" : "paid")}
                  </div>
                  <div className={`h-2.5 rounded bg-muted/40 ${i % 2 === 0 ? "w-16" : "w-14"}`} />
                </div>
              ))}
            </div>
            <div className="absolute inset-0 bg-gradient-to-b from-content-bg/20 via-content-bg/70 to-content-bg" />

            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-purple-100 dark:bg-purple-950/50">
                <Receipt className="size-7 text-purple-600 dark:text-purple-400" />
              </div>
              <h2 className="mt-5 text-xl font-semibold tracking-tight">
                {t("emptyTitle")}</h2>
              <p className="mt-2 max-w-md text-sm text-muted-foreground leading-relaxed">
                {t("emptyDescription")}</p>
              <Button
                onClick={() => openDrawer("expense")}
                size="lg"
                className="mt-6 bg-emerald-600 hover:bg-emerald-700"
              >
                <Plus className="mr-2 size-4" />
                {t("newClaim")}</Button>
            </div>
          </div>
        </div>
      </ContentReveal>
    );
  }

  return (
    <ContentReveal>
      <div className="space-y-3 sm:space-y-6">
        {/* Header */}
        <PageHeader
          title={t("title")}
          description={t("description")}
        >
          <Button
            size="sm"
            onClick={() => openDrawer("expense")}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            <Plus className="mr-2 size-4" />
            {t("newExpense")}</Button>
        </PageHeader>

        {(countsError || claimsError) && <p role="alert" className="text-sm text-destructive">{t((countsError || claimsError)!)}</p>}
        {/* Stats strip */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">{t("total")}</p>
            <p className="text-lg sm:text-2xl font-bold font-mono tabular-nums tracking-tight">
              {totalAmount}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-blue-500" />
              {t("pending")}</p>
            <p className="text-lg sm:text-2xl font-bold font-mono tabular-nums tracking-tight text-blue-600 dark:text-blue-400">
              {pendingAmount}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-emerald-500" />
              {t("approved")}</p>
            <p className="text-lg sm:text-2xl font-bold font-mono tabular-nums tracking-tight text-emerald-600 dark:text-emerald-400">
              {approvedAmount}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">{t("claims")}</p>
            <p className="text-lg sm:text-2xl font-bold tabular-nums tracking-tight">
              {countsData?.total || 0}
            </p>
          </div>
        </div>

        <div className="h-px bg-border" />

        {/* Filters */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0">
            <Tabs value={statusFilter} onValueChange={setStatusFilter}>
              <TabsList>
                <TabsTrigger value="all" className="whitespace-nowrap">{t("all")} ({countsData?.total || 0})</TabsTrigger>
                <TabsTrigger value="draft" className="whitespace-nowrap">{t("draft")} ({statusCounts.draft || 0})</TabsTrigger>
                <TabsTrigger value="submitted" className="whitespace-nowrap">{t("submitted")} ({statusCounts.submitted || 0})</TabsTrigger>
                <TabsTrigger value="approved" className="whitespace-nowrap">{t("approved")} ({statusCounts.approved || 0})</TabsTrigger>
                <TabsTrigger value="rejected" className="whitespace-nowrap">{t("rejected")} ({statusCounts.rejected || 0})</TabsTrigger>
                <TabsTrigger value="paid" className="whitespace-nowrap">{t("paid")} ({statusCounts.paid || 0})</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder={t("search")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground shrink-0">{t("from")}</span>
            <DatePicker
              value={dateFrom}
              onChange={(v) => setDateFrom(v)}
              placeholder={t("startDateFilter")}
              className="h-8 w-40 text-xs"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground shrink-0">{t("to")}</span>
            <DatePicker
              value={dateTo}
              onChange={(v) => setDateTo(v)}
              placeholder={t("endDateFilter")}
              className="h-8 w-40 text-xs"
            />
          </div>
          <Select
            value={`${sortBy}:${sortOrder}`}
            onValueChange={(v) => {
              const [key, order] = v.split(":");
              setSortBy(key);
              setSortOrder(order as "asc" | "desc");
            }}
          >
            <SelectTrigger className="h-8 w-44 text-xs">
              <SelectValue placeholder={t("sortBy")}>{expenseSortLabel(t, `${sortBy}:${sortOrder}`)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="created:desc">{t("newest")}</SelectItem>
              <SelectItem value="created:asc">{t("oldest")}</SelectItem>
              <SelectItem value="total:desc">{t("highest")}</SelectItem>
              <SelectItem value="total:asc">{t("lowest")}</SelectItem>
              <SelectItem value="title:asc">{t("titleAsc")}</SelectItem>
              <SelectItem value="title:desc">{t("titleDesc")}</SelectItem>
            </SelectContent>
          </Select>
          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs text-muted-foreground"
              onClick={() => {
                setDateFrom("");
                setDateTo("");
              }}
            >
              <X className="mr-1 size-3" />
              {t("clearDates")}</Button>
          )}
        </div>

        {/* Table */}
        {refetching || pendingSearch ? (
          <BrandLoader className="h-40" />
        ) : (
          <MotionConfig reducedMotion="never">
            <motion.div
              key={fetchKey}
              initial={{ opacity: 0, y: 12, filter: "blur(10px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{
                duration: 0.8,
                delay: 0.12,
                ease: [0.22, 1, 0.36, 1],
              }}
              style={{ willChange: "opacity, transform, filter" }}
            >
              <DataTable
                columns={columns}
                data={claims}
                loading={loading}
                emptyMessage={t("emptyFiltered")}
                onRowClick={(r) =>
                  router.push(`/purchases/expenses/${r.id}`)
                }
                sortBy={sortBy}
                sortOrder={sortOrder}
                onSort={handleSort}
              />
            </motion.div>
          </MotionConfig>
        )}

        {/* Infinite scroll sentinel */}
        {hasMore && !refetching && (
          <div ref={sentinelRef} className="flex items-center justify-center py-6">
            {loadingMore && (
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            )}
          </div>
        )}
      </div>
    </ContentReveal>
  );
}
