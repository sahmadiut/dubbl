"use client";

import { usePresentation } from "@/i18n/provider";
import type { NumberPresentation } from "@/i18n/numbers";
import { useTranslations } from "next-intl";
import { BidiText, IdentifierText } from "@/components/ui/bidi-text";
import { accrualJson, accrualFailureMessage, accrualStatusLabel } from "@/i18n/accrual-presentation";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useDebounce } from "@/lib/hooks/use-debounce";
import { useRouter } from "next/navigation";
import { Plus, CalendarRange, CalendarClock, X, Search, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { DataTable, type Column } from "@/components/dashboard/data-table";
import { StatCard } from "@/components/dashboard/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { assetMoneyDisplay as formatMoney } from "@/lib/money/asset-display";
import { devDelay } from "@/lib/dev-delay";
import { useCreateDrawer } from "@/components/dashboard/create-drawer";
import { useDocumentTitle } from "@/lib/hooks/use-document-title";
import { BrandLoader } from "@/components/dashboard/brand-loader";
import { ContentReveal } from "@/components/ui/content-reveal";

interface AccrualEntry {
  id: string;
  periodDate: string;
  amount: number;
  posted: boolean;
  journalEntryId: string | null;
}

interface AccrualSchedule {
  id: string;
  description: string;
  totalAmount: number;
  startDate: string;
  endDate: string;
  periods: number;
  status: string;
  entries: AccrualEntry[];
}

const statusColors: Record<string, string> = {
  active: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300",
  completed: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  cancelled: "border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-300",
};

function buildColumns(t: ReturnType<typeof useTranslations<"Accruals">>, unitPresentation: NumberPresentation = { locale: "en-US", numerals: "latn" }): Column<AccrualSchedule>[] {
  return [
    {
      key: "description",
      header: t("purpose"),
      render: (r) => (
        <span className="text-sm font-medium"><BidiText>{r.description}</BidiText></span>
      ),
    },
    {
      key: "total",
      header: t("total"),
      sortKey: "total",
      className: "w-28 text-end",
      render: (r) => (
        <span className="font-mono text-sm tabular-nums">
          <BidiText>{formatMoney(r.totalAmount, unitPresentation)}</BidiText>
        </span>
      ),
    },
    {
      key: "periods",
      header: t("months"),
      className: "w-24 text-end",
      render: (r) => (
        <span className="text-sm tabular-nums"><BidiText>{r.periods}</BidiText></span>
      ),
    },
    {
      key: "start",
      header: t("starts"),
      sortKey: "start",
      className: "w-28",
      render: (r) => <span className="text-sm"><IdentifierText>{r.startDate}</IdentifierText></span>,
    },
    {
      key: "status",
      header: t("status"),
      className: "w-24",
      render: (r) => (
        <Badge variant="outline" className={statusColors[r.status] || ""}>
          <BidiText>{accrualStatusLabel(t, r.status)}</BidiText>
        </Badge>
      ),
    },
  ];
}

export default function AccrualsPage() {
  const unitPresentation = usePresentation();
  const t = useTranslations("Accruals");
  const [error, setError] = useState("");
  const router = useRouter();
  const { open: openDrawer } = useCreateDrawer();
  const [schedules, setSchedules] = useState<AccrualSchedule[]>([]);
  const [initialLoad, setInitialLoad] = useState(true);
  const [refetching, setRefetching] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [fetchKey, setFetchKey] = useState(0);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search);

  useDocumentTitle(t("documentTitle"));

  const PAGE_SIZE = 50;
  const orgId = typeof window !== "undefined" ? localStorage.getItem("activeOrgId") : null;

  const columns = useMemo(() => buildColumns(t, unitPresentation), [t, unitPresentation]);

  const buildParams = useCallback((p: number) => {
    const params = new URLSearchParams();
    if (statusFilter !== "all") params.set("status", statusFilter);
    params.set("page", String(p));
    params.set("limit", String(PAGE_SIZE));
    return params;
  }, [statusFilter]);

  // Fetch first page when filters change
  useEffect(() => {
    if (!orgId) { setError(t("unauthenticated")); setInitialLoad(false); return; }
    let cancelled = false;
    setError("");
    setRefetching(true);
    setPage(1);

    fetch(`/api/v1/accrual-schedules?${buildParams(1)}`, {
      headers: { "x-organization-id": orgId },
    })
      .then((r) => accrualJson(r, t, t("loadFailed"), "list"))
      .then((data) => {
        if (cancelled) return;
        setSchedules(data.data);
        setTotalCount(data.pagination.total);
      })
      .catch((err) => { if (!cancelled) setError(accrualFailureMessage(err, t, t("loadFailed"))); })
      .then(() => devDelay())
      .finally(() => { if (!cancelled) { setInitialLoad(false); setRefetching(false); setFetchKey((k) => k + 1); } });

    return () => { cancelled = true; };
  }, [orgId, buildParams, t]);

  // Load more
  const loadMore = useCallback(() => {
    if (!orgId || loadingMore) return;
    const nextPage = page + 1;
    setLoadingMore(true);

    fetch(`/api/v1/accrual-schedules?${buildParams(nextPage)}`, {
      headers: { "x-organization-id": orgId },
    })
      .then((r) => accrualJson(r, t, t("loadFailed"), "list"))
      .then((data) => {
        if (data.data) {
          setError("");
          setSchedules((prev) => [...prev, ...data.data]);
          setPage(nextPage);
        }
      })
      .catch((err) => { setError(accrualFailureMessage(err, t, t("loadFailed"))); })
      .finally(() => setLoadingMore(false));
  }, [orgId, page, buildParams, loadingMore, t]);

  const hasMore = schedules.length < totalCount;
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Infinite scroll
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !refetching) loadMore();
      },
      { rootMargin: "200px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore, refetching]);

  const hasFilters = !!search;
  const pendingSearch = search !== debouncedSearch;

  const [searchKey, setSearchKey] = useState(0);
  const filteredSchedules = useMemo(() => {
    if (!debouncedSearch) return schedules;
    const q = debouncedSearch.toLowerCase();
    return schedules.filter((s) => s.description.toLowerCase().includes(q));
  }, [schedules, debouncedSearch]);

  // Bump searchKey when debounced search changes to trigger ContentReveal
  useEffect(() => {
    setSearchKey((k) => k + 1);
  }, [debouncedSearch]);

  const totalScheduled = useMemo(
    () => schedules.reduce((sum, s) => sum + (s.status !== "cancelled" ? BigInt(s.totalAmount) : 0n), 0n),
    [schedules]
  );
  const runningCount = useMemo(
    () => schedules.filter((s) => s.status === "active").length,
    [schedules]
  );

  if (initialLoad) return <BrandLoader />;
  if (error && schedules.length === 0) return <p role="alert">{error}</p>;

  if (!initialLoad && !refetching && schedules.length === 0 && statusFilter === "all" && !hasFilters) {
    return (
      <ContentReveal>
        <div className="pt-12 pb-12 space-y-10">
          {/* Top: title + CTA */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">{t("accruals")}</h2>
              <p className="mt-1 text-sm text-muted-foreground max-w-md">
                {t("intro")}
              </p>
            </div>
            <Button type="button"
              onClick={() => openDrawer("accrualSchedule")}
              className="h-auto min-h-9 min-w-0 whitespace-normal text-start bg-emerald-600 hover:bg-emerald-700 shrink-0"
            >
              <Plus className="me-2 size-4" />
              {t("new")}
            </Button>
          </div>

          <div className="grid gap-6 sm:gap-8 grid-cols-1 lg:grid-cols-[1fr_1fr] items-start">
            {/* Left: how it works */}
            <div className="rounded-xl border bg-card overflow-hidden">
              <div className="bg-muted/30 px-3 sm:px-5 py-3 border-b">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("how")}</p>
              </div>
              <div className="divide-y">
                <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 px-3 sm:px-5 py-3.5">
                  <div className="flex min-w-0 flex-wrap items-center gap-3">
                    <div className="flex size-7 items-center justify-center rounded-md bg-blue-50 dark:bg-blue-950/40">
                      <CalendarRange className="size-3.5 text-blue-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{t("oneOff")}</p>
                      <p className="text-[11px] text-muted-foreground">{t("insurance")}</p>
                    </div>
                  </div>
                  <span className="font-mono text-sm font-medium"><BidiText>{formatMoney(120000, unitPresentation)}</BidiText></span>
                </div>
                <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 px-3 sm:px-5 py-3.5 bg-teal-50/30 dark:bg-teal-950/10">
                  <div className="flex min-w-0 flex-wrap items-center gap-3">
                    <div className="flex size-7 items-center justify-center rounded-md bg-teal-50 dark:bg-teal-950/40">
                      <CalendarClock className="size-3.5 text-teal-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-teal-700 dark:text-teal-300">{t("spreadExample")}</p>
                      <p className="text-[11px] text-muted-foreground">{t("littleEachMonth")}</p>
                    </div>
                  </div>
                  <span className="font-mono text-sm font-medium text-teal-600 dark:text-teal-400"><BidiText>{t("monthlyExample", { amount: formatMoney(10000, unitPresentation) })}</BidiText></span>
                </div>
                <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 px-3 sm:px-5 py-3.5">
                  <div className="flex min-w-0 flex-wrap items-center gap-3">
                    <div className="size-7" />
                    <p className="text-sm font-semibold">{t("fairShare")}</p>
                  </div>
                  <span className="font-mono text-sm font-bold"><BidiText>{formatMoney(10000, unitPresentation)}</BidiText></span>
                </div>
              </div>
            </div>

            {/* Right: Use cases */}
            <div className="space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("when")}</p>
              {[
                {
                  title: t("upfront"),
                  desc: t("upfrontDescription"),
                  color: "border-s-blue-400",
                },
                {
                  title: t("bigBill"),
                  desc: t("bigBillDescription"),
                  color: "border-s-amber-400",
                },
                {
                  title: t("income"),
                  desc: t("incomeDescription"),
                  color: "border-s-teal-400",
                },
                {
                  title: t("smoother"),
                  desc: t("smootherDescription"),
                  color: "border-s-purple-400",
                },
              ].map(({ title, desc, color }) => (
                <div key={title} className={`rounded-lg border border-s-[3px] ${color} bg-card px-4 py-3`}>
                  <p className="text-sm font-medium">{title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </ContentReveal>
    );
  }

  return (
    <ContentReveal className="space-y-6">
      {error && <p role="alert">{error}</p>}
      {/* Top: Stats */}
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard title={t("scheduled")} value={formatMoney(totalScheduled, unitPresentation)} icon={CalendarRange} />
        <StatCard title={t("runningTab")} value={runningCount.toString()} icon={CalendarClock} />
      </div>

      <div className="h-px bg-border" />

      {/* Accrual table */}
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Tabs dir={unitPresentation.locale === "fa-IR" ? "rtl" : "ltr"} value={statusFilter} onValueChange={setStatusFilter}>
            <TabsList aria-label={t("status")} className="h-auto max-w-full flex-wrap">
              <TabsTrigger value="all" className="h-auto whitespace-normal text-start">{t("all")}</TabsTrigger>
              <TabsTrigger value="active" className="h-auto whitespace-normal text-start">{t("runningTab")}</TabsTrigger>
              <TabsTrigger value="completed" className="h-auto whitespace-normal text-start">{t("finishedTab")}</TabsTrigger>
              <TabsTrigger value="cancelled" className="h-auto whitespace-normal text-start">{t("cancelledTab")}</TabsTrigger>
            </TabsList>
          </Tabs>

          <Button type="button"
            onClick={() => openDrawer("accrualSchedule")}
            size="sm"
            className="h-auto min-h-9 min-w-0 whitespace-normal text-start bg-emerald-600 hover:bg-emerald-700"
          >
            <Plus className="me-2 size-4" />
            {t("new")}
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-auto">
            <Search aria-hidden="true" className="absolute start-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              aria-label={t("search")} dir="auto"
            placeholder={t("search")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 w-full sm:w-56 ps-8 text-xs"
            />
          </div>
          {hasFilters && (
            <Button type="button"
              variant="ghost"
              size="sm"
              className="h-8 text-xs text-muted-foreground"
              onClick={() => { setSearch(""); }}
            >
              <X className="me-1 size-3" />
              {t("clearFilters")}
            </Button>
          )}
        </div>

        {refetching || pendingSearch ? (
          <BrandLoader className="h-48" />
        ) : (
          <ContentReveal key={`${fetchKey}-${searchKey}`}>
            <DataTable
              columns={columns}
              data={filteredSchedules}
              loading={false}
              emptyMessage={t("noMatches")}
              onRowClick={(r) => router.push(`/accounting/accruals/${r.id}`)}
            />
          </ContentReveal>
        )}

        {/* Infinite scroll sentinel & count */}
        {!refetching && !pendingSearch && filteredSchedules.length > 0 && (
          <>
            <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 pt-1">
              <p className="text-xs text-muted-foreground">
                {t("showing", { shown: schedules.length, count: totalCount })}
              </p>
            </div>
            {hasMore && (
              <div ref={sentinelRef} className="flex justify-center py-4">
                {loadingMore && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
              </div>
            )}
          </>
        )}
      </div>
    </ContentReveal>
  );
}
