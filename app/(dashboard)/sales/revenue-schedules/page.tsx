"use client";

import { bankMoneyDisplay as exampleMoney } from "@/lib/money/bank-display";
import { usePresentation } from "@/i18n/provider";
import type { NumberPresentation } from "@/i18n/numbers";
import { useTranslations } from "next-intl";
import { revenueMethodLabel, revenueStatusLabel, revenueScheduleValid, type RevenueScheduleTranslate, type RevenueReadError } from "@/i18n/revenue-schedule-presentation";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useDebounce } from "@/lib/hooks/use-debounce";
import { useRouter } from "next/navigation";
import { Plus, CalendarClock, TrendingUp, X, Search, Loader2 } from "lucide-react";
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

interface RevenueScheduleEntry {
  id: string;
  recognized: boolean;
}

interface RevenueSchedule {
  id: string;
  totalAmount: number;
  recognizedAmount: number;
  startDate: string;
  endDate: string;
  method: string;
  status: string;
  entries?: RevenueScheduleEntry[];
}

const statusColors: Record<string, string> = {
  active: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300",
  completed:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  cancelled: "border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-300",
};

function buildColumns(t: RevenueScheduleTranslate, unitPresentation: NumberPresentation = { locale: "en-US", numerals: "latn" }): Column<RevenueSchedule>[] {
  return [
    {
      key: "period",
      header: t("period"),
      render: (r) => (
        <span className="text-sm">
          {r.startDate} &ndash; {r.endDate}
        </span>
      ),
    },
    {
      key: "method",
      header: t("spreadHeading"),
      className: "w-40",
      render: (r) => (
        <span className="text-sm text-muted-foreground">
          {revenueMethodLabel(t, r.method)}
        </span>
      ),
    },
    {
      key: "status",
      header: t("status"),
      className: "w-28",
      render: (r) => (
        <Badge variant="outline" className={Object.hasOwn(statusColors, r.status) ? statusColors[r.status] : ""}>
          {revenueStatusLabel(t, r.status)}
        </Badge>
      ),
    },
    {
      key: "total",
      header: t("total"),
      className: "w-28 text-right",
      render: (r) => (
        <span className="font-mono text-sm tabular-nums">
          {formatMoney(r.totalAmount, unitPresentation)}
        </span>
      ),
    },
    {
      key: "recognized",
      header: t("recognized"),
      className: "w-32 text-right",
      render: (r) => (
        <span className="font-mono text-sm tabular-nums text-emerald-600">
          {formatMoney(r.recognizedAmount, unitPresentation)}
        </span>
      ),
    },
    {
      key: "remaining",
      header: t("remaining"),
      className: "w-32 text-right",
      render: (r) => (
        <span className="font-mono text-sm tabular-nums text-amber-600">
          {formatMoney(r.totalAmount - r.recognizedAmount, unitPresentation)}
        </span>
      ),
    },
  ];
}

export default function RevenueSchedulesPage() {
  const unitPresentation = usePresentation();
  const t = useTranslations("RevenueSchedules");
  const [error, setError] = useState<RevenueReadError | null>(null);
  const router = useRouter();
  const { open: openDrawer } = useCreateDrawer();
  const [schedules, setSchedules] = useState<RevenueSchedule[]>([]);
  const [initialLoad, setInitialLoad] = useState(true);
  const [refetching, setRefetching] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [fetchKey, setFetchKey] = useState(0);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search);

  useDocumentTitle(t("listDocumentTitle"));

  const PAGE_SIZE = 50;
  const orgId = typeof window !== "undefined" ? localStorage.getItem("activeOrgId") : null;

  const columns = useMemo(() => buildColumns(t, unitPresentation), [t, unitPresentation]);

  const buildParams = useCallback((p: number) => {
    const params = new URLSearchParams();
    params.set("page", String(p));
    params.set("limit", String(PAGE_SIZE));
    return params;
  }, []);

  // Fetch first page when filters change
  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;
    setRefetching(true);
    setPage(1);

    fetch(`/api/v1/revenue-schedules?${buildParams(1)}`, {
      headers: { "x-organization-id": orgId },
    })
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then((data) => {
        if (cancelled) return;
        if (!Array.isArray(data?.data) || !data.data.every((row: unknown) => revenueScheduleValid(row))) throw new Error();
        setError(null);
        setSchedules(data.data);
        setTotalCount(data.pagination?.total || 0);
      })
      .catch(() => { if (!cancelled) setError("readFailed"); })
      .then(() => devDelay())
      .finally(() => { if (!cancelled) { setInitialLoad(false); setRefetching(false); setFetchKey((k) => k + 1); } });

    return () => { cancelled = true; };
  }, [orgId, buildParams]);

  // Load more
  const loadMore = useCallback(() => {
    if (!orgId || loadingMore) return;
    const nextPage = page + 1;
    setLoadingMore(true);

    fetch(`/api/v1/revenue-schedules?${buildParams(nextPage)}`, {
      headers: { "x-organization-id": orgId },
    })
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then((data) => {
        if (!Array.isArray(data?.data) || !data.data.every((row: unknown) => revenueScheduleValid(row))) throw new Error();
        setError(null);
        if (data.data) {
          setSchedules((prev) => [...prev, ...data.data]);
          setPage(nextPage);
        }
      })
      .catch(() => setError("moreFailed"))
      .finally(() => setLoadingMore(false));
  }, [orgId, page, buildParams, loadingMore]);

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
    let list = schedules;
    if (statusFilter !== "all") {
      list = list.filter((s) => s.status === statusFilter);
    }
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      list = list.filter(
        (s) =>
          s.startDate.toLowerCase().includes(q) ||
          s.endDate.toLowerCase().includes(q) ||
          revenueMethodLabel(t, s.method).toLowerCase().includes(q)
      );
    }
    return list;
  }, [schedules, statusFilter, debouncedSearch, t]);

  // Bump searchKey when debounced search or status filter changes to trigger ContentReveal
  useEffect(() => {
    setSearchKey((k) => k + 1);
  }, [debouncedSearch, statusFilter]);

  const totalScheduled = useMemo(
    () => schedules.reduce((sum, s) => sum + (s.status !== "cancelled" ? BigInt(s.totalAmount) : 0n), 0n),
    [schedules]
  );
  const totalRecognized = useMemo(
    () => schedules.reduce((sum, s) => sum + (s.status !== "cancelled" ? BigInt(s.recognizedAmount) : 0n), 0n),
    [schedules]
  );
  const totalRemaining = totalScheduled - totalRecognized;

  if (initialLoad) return <BrandLoader />;

  if (!initialLoad && !refetching && !error && schedules.length === 0 && statusFilter === "all" && !hasFilters) {
    return (
      <ContentReveal>
        <div className="pt-12 pb-12 space-y-10">
          {/* Top: title + CTA */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">{t("title")}</h2>
              <p className="mt-1 text-sm text-muted-foreground max-w-md">
                {t("description")}
              </p>
            </div>
            <Button
              onClick={() => openDrawer("revenueSchedule")}
              className="bg-emerald-600 hover:bg-emerald-700 shrink-0"
            >
              <Plus className="mr-2 size-4" />
              {t("newSchedule")}
            </Button>
          </div>

          <div className="grid gap-6 sm:gap-8 grid-cols-1 lg:grid-cols-[1fr_1fr] items-start">
            {/* Left: how it works */}
            <div className="rounded-xl border bg-card overflow-hidden">
              <div className="bg-muted/30 px-3 sm:px-5 py-3 border-b">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("howItWorks")}</p>
              </div>
              <div className="divide-y">
                <div className="flex items-center justify-between px-3 sm:px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className="flex size-7 items-center justify-center rounded-md bg-blue-50 dark:bg-blue-950/40">
                      <CalendarClock className="size-3.5 text-blue-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{t("paidUpfront")}</p>
                      <p className="text-[11px] text-muted-foreground">{t("exampleInvoice")}</p>
                    </div>
                  </div>
                  <span className="font-mono text-sm font-medium">{exampleMoney(120000n, "USD", unitPresentation)}</span>
                </div>
                <div className="flex items-center justify-between px-3 sm:px-5 py-3.5 bg-emerald-50/30 dark:bg-emerald-950/10">
                  <div className="flex items-center gap-3">
                    <div className="flex size-7 items-center justify-center rounded-md bg-emerald-50 dark:bg-emerald-950/40">
                      <TrendingUp className="size-3.5 text-emerald-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">{t("eachMonth")}</p>
                      <p className="text-[11px] text-muted-foreground">{t("spreadEvenly")}</p>
                    </div>
                  </div>
                  <span className="font-mono text-sm font-medium text-emerald-600 dark:text-emerald-400">{"+" + exampleMoney(10000n, "USD", unitPresentation)}</span>
                </div>
                <div className="flex items-center justify-between px-3 sm:px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className="size-7" />
                    <p className="text-sm font-semibold">{t("afterYear")}</p>
                  </div>
                  <span className="font-mono text-sm font-bold">{exampleMoney(120000n, "USD", unitPresentation)}</span>
                </div>
              </div>
            </div>

            {/* Right: Use cases */}
            <div className="space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("whenToUse")}</p>
              {[
                {
                  title: t("annualTitle"),
                  desc: t("annualDescription"),
                  color: "border-l-blue-400",
                },
                {
                  title: t("retainerTitle"),
                  desc: t("retainerDescription"),
                  color: "border-l-amber-400",
                },
                {
                  title: t("deliveryTitle"),
                  desc: t("deliveryDescription"),
                  color: "border-l-teal-400",
                },
                {
                  title: t("projectTitle"),
                  desc: t("projectDescription"),
                  color: "border-l-purple-400",
                },
              ].map(({ title, desc, color }) => (
                <div key={title} className={`rounded-lg border border-l-[3px] ${color} bg-card px-4 py-3`}>
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
      {error && <p role="alert" className="text-sm text-destructive">{t(error)}</p>}
      {/* Top: Stats */}
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard title={t("scheduled")} value={formatMoney(totalScheduled, unitPresentation)} icon={CalendarClock} />
        <StatCard title={t("recognized")} value={formatMoney(totalRecognized, unitPresentation)} icon={TrendingUp} />
        <StatCard title={t("remaining")} value={formatMoney(totalRemaining, unitPresentation)} icon={CalendarClock} />
      </div>

      <div className="h-px bg-border" />

      {/* Revenue schedule table */}
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Tabs value={statusFilter} onValueChange={setStatusFilter}>
            <TabsList className="overflow-x-auto">
              <TabsTrigger value="all" className="whitespace-nowrap">{t("all")}</TabsTrigger>
              <TabsTrigger value="active" className="whitespace-nowrap" title={t("activeHint")}>{t("activeTab")}</TabsTrigger>
              <TabsTrigger value="completed" className="whitespace-nowrap" title={t("completedHint")}>{t("completedTab")}</TabsTrigger>
              <TabsTrigger value="cancelled" className="whitespace-nowrap">{t("cancelledTab")}</TabsTrigger>
            </TabsList>
          </Tabs>

          <Button
            onClick={() => openDrawer("revenueSchedule")}
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            <Plus className="mr-2 size-4" />
            {t("newSchedule")}
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              placeholder={t("search")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 w-56 pl-8 text-xs"
            />
          </div>
          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs text-muted-foreground"
              onClick={() => { setSearch(""); }}
            >
              <X className="mr-1 size-3" />
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
              onRowClick={(r) => router.push(`/sales/revenue-schedules/${r.id}`)}
            />
          </ContentReveal>
        )}

        {/* Infinite scroll sentinel & count */}
        {!refetching && !pendingSearch && filteredSchedules.length > 0 && (
          <>
            <div className="flex items-center justify-between pt-1">
              <p className="text-xs text-muted-foreground">
                {t("showing", { loaded: schedules.length, total: totalCount })}
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
