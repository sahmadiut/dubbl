"use client";

import { bankMoneyDisplay as exampleMoney } from "@/lib/money/bank-display";
import { usePresentation } from "@/i18n/provider";
import type { NumberPresentation } from "@/i18n/numbers";
import { useTranslations } from "next-intl";
import { goodsReceiptStatusLabel } from "@/i18n/goods-receipt-presentation";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useDebounce } from "@/lib/hooks/use-debounce";
import { useRouter } from "next/navigation";
import { PackageCheck, Truck, X, Search, Loader2, ArrowRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { DataTable, type Column } from "@/components/dashboard/data-table";
import { StatCard } from "@/components/dashboard/stat-card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DatePicker } from "@/components/ui/date-picker";
import { Button } from "@/components/ui/button";
import { procurementReceipt, procurementMoney, procurementOverviewText, procurementFilter } from "@/lib/money/procurement-ui";
import { devDelay } from "@/lib/dev-delay";
import { useDocumentTitle } from "@/lib/hooks/use-document-title";
import { BrandLoader } from "@/components/dashboard/brand-loader";
import { ContentReveal } from "@/components/ui/content-reveal";
import Link from "next/link";

interface GoodsReceipt {
  id: string; receiptNumber: string; date: string; status: string;
  currencyCode: string; total: bigint; contact: { name: string } | null;
}

const statusColors: Record<string, string> = {
  draft: "",
  received:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  billed:
    "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300",
  void: "border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-300",
};

function buildColumns(t: ReturnType<typeof useTranslations<"GoodsReceipts">>, unitPresentation: NumberPresentation = { locale: "en-US", numerals: "latn" }): Column<GoodsReceipt>[] {
  return [
    {
      key: "number",
      header: t("number"),
      sortKey: "number",
      className: "w-32",
      render: (r) => (
        <span className="font-mono text-sm">{r.receiptNumber}</span>
      ),
    },
    {
      key: "contact",
      header: t("supplier"),
      render: (r) => (
        <span className="text-sm font-medium">{r.contact?.name || "-"}</span>
      ),
    },
    {
      key: "date",
      header: t("date"),
      sortKey: "date",
      className: "w-28",
      render: (r) => <span className="text-sm">{r.date}</span>,
    },
    {
      key: "status",
      header: t("status"),
      className: "w-24",
      render: (r) => (
        <Badge variant="outline" className={statusColors[r.status] || ""}>
          {goodsReceiptStatusLabel(t, r.status)}
        </Badge>
      ),
    },
    {
      key: "value",
      header: t("valueReceived"),
      className: "w-32 text-right",
      render: (r) => (
        <span className="font-mono text-sm tabular-nums break-all">
          {procurementMoney(r.total, r.currencyCode, unitPresentation)}
        </span>
      ),
    },
  ];
}

export default function GoodsReceiptsPage() {
  const orgId = typeof window !== "undefined" ? localStorage.getItem("activeOrgId") : null;
  return <GoodsReceiptsContent key={orgId} />;
}

function GoodsReceiptsContent() {
  const unitPresentation = usePresentation();
  const t = useTranslations("GoodsReceipts");
  const router = useRouter();
  const [readError, setReadError] = useState<string | null>(null);
  const generation = useRef(0);
  const [receipts, setReceipts] = useState<GoodsReceipt[]>([]);
  const [initialLoad, setInitialLoad] = useState(true);
  const [refetching, setRefetching] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [fetchKey, setFetchKey] = useState(0);
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("created");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search);

  useDocumentTitle(t("documentTitle"));

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

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
    if (!orgId) return;
    let cancelled = false;
    const controller = new AbortController();
    generation.current += 1;
    setLoadingMore(false);
    setRefetching(true);
    setPage(1);

    fetch(`/api/v1/goods-receipts?${buildParams(1)}`, {
      headers: { "x-organization-id": orgId }, signal: controller.signal,
    })
      .then((r) => { if (!r.ok) throw new Error(t("readFailed")); return r.json(); })
      .then((data) => {
        if (cancelled) return;
        if (!Array.isArray(data?.data)) throw new Error(t("readFailed"));
        setReceipts(data.data.map(procurementReceipt));
        setReadError(null);
        setTotalCount(data.pagination?.total || 0);
      })
      .then(() => devDelay())
      .catch(() => { if (!cancelled) { setReceipts([]); setReadError(t("readFailed")); } })
      .finally(() => { if (!cancelled) { setInitialLoad(false); setRefetching(false); setFetchKey((k) => k + 1); } });

    return () => { cancelled = true; controller.abort(); };
  }, [orgId, buildParams, t]);

  // Load more
  const loadMore = useCallback(() => {
    if (!orgId || loadingMore) return;
    const nextPage = page + 1;
    const requestGeneration = generation.current;
    setLoadingMore(true);

    fetch(`/api/v1/goods-receipts?${buildParams(nextPage)}`, {
      headers: { "x-organization-id": orgId },
    })
      .then((r) => { if (!r.ok) throw new Error(t("readFailed")); return r.json(); })
      .then((data) => {
        if (requestGeneration !== generation.current) return;
        if (!Array.isArray(data?.data)) throw new Error(t("readFailed"));
        const adopted = data.data.map(procurementReceipt);
        setReceipts((prev) => [...prev, ...adopted]);
        setReadError(null);
        setPage(nextPage);
      })
      .catch(() => { if (requestGeneration === generation.current) { setReceipts([]); setReadError(t("readFailed")); } })
      .finally(() => { if (requestGeneration === generation.current) setLoadingMore(false); });
  }, [orgId, page, buildParams, loadingMore, t]);

  const hasMore = receipts.length < totalCount;
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

  const hasFilters = search || dateFrom || dateTo;
  const pendingSearch = search !== debouncedSearch;

  const [searchKey, setSearchKey] = useState(0);
  const filteredReceipts = useMemo(() => procurementFilter(receipts, row => row.receiptNumber, row => row.date,
    { search: debouncedSearch, from: dateFrom, to: dateTo, sortBy, sortOrder }), [receipts, debouncedSearch, dateFrom, dateTo, sortBy, sortOrder]);

  // Bump searchKey when debounced search changes to trigger ContentReveal
  useEffect(() => {
    setSearchKey((k) => k + 1);
  }, [debouncedSearch]);

  const totalValue = procurementOverviewText(filteredReceipts, undefined, unitPresentation);

  if (initialLoad) return <BrandLoader />;
  if (readError) return <p role="alert" className="text-sm text-red-600">{readError}</p>;

  if (!initialLoad && !refetching && receipts.length === 0 && statusFilter === "all" && !hasFilters) {
    return (
      <ContentReveal>
        <div className="pt-12 pb-12 space-y-10">
          {/* Top: title + hint (no "new" — goods are received from a purchase order) */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">{t("title")}</h2>
              <p className="mt-1 text-sm text-muted-foreground max-w-md">
                {t("description")}
              </p>
            </div>
            <Button variant="outline" asChild className="shrink-0">
              <Link href="/purchases/orders">
                {t("goOrders")}
                <ArrowRight className="ml-2 size-4" />
              </Link>
            </Button>
          </div>

          <div className="grid gap-6 sm:gap-8 grid-cols-1 lg:grid-cols-[1fr_1fr] items-start">
            {/* Left: how it works */}
            <div className="rounded-xl border bg-card overflow-hidden">
              <div className="bg-muted/30 px-3 sm:px-5 py-3 border-b">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("howReceiving")}</p>
              </div>
              <div className="divide-y">
                <div className="flex items-center justify-between px-3 sm:px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className="flex size-7 items-center justify-center rounded-md bg-blue-50 dark:bg-blue-950/40">
                      <Truck className="size-3.5 text-blue-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{t("orderPlaced")}</p>
                      <p className="text-[11px] text-muted-foreground">PO-0042</p>
                    </div>
                  </div>
                  <span className="font-mono text-sm font-medium">{exampleMoney(120000n, "USD", unitPresentation)}</span>
                </div>
                <div className="flex items-center justify-between px-3 sm:px-5 py-3.5 bg-emerald-50/30 dark:bg-emerald-950/10">
                  <div className="flex items-center gap-3">
                    <div className="flex size-7 items-center justify-center rounded-md bg-emerald-50 dark:bg-emerald-950/40">
                      <PackageCheck className="size-3.5 text-emerald-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">{t("goodsReceived")}</p>
                      <p className="text-[11px] text-muted-foreground">GRN-0001</p>
                    </div>
                  </div>
                  <span className="font-mono text-sm font-medium text-emerald-600 dark:text-emerald-400">{"+" + exampleMoney(120000n, "USD", unitPresentation)}</span>
                </div>
                <div className="flex items-center justify-between px-3 sm:px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className="size-7" />
                    <p className="text-sm font-semibold">{t("stockOnHand")}</p>
                  </div>
                  <span className="font-mono text-sm font-bold">{t("updated")}</span>
                </div>
              </div>
            </div>

            {/* Right: how to record one */}
            <div className="space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("howRecord")}</p>
              {[
                {
                  title: t("openOrder"),
                  desc: t("openOrderHint"),
                  color: "border-l-blue-400",
                },
                {
                  title: t("markArrived"),
                  desc: t("markArrivedHint"),
                  color: "border-l-emerald-400",
                },
                {
                  title: t("stockUpdates"),
                  desc: t("stockUpdatesHint"),
                  color: "border-l-amber-400",
                },
                {
                  title: t("billLater"),
                  desc: t("billLaterHint"),
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
      {/* Top: Stats */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="[&_p]:break-all"><StatCard title={t("sampleValue")} value={totalValue} icon={PackageCheck} /></div>
        <StatCard title={t("receipts")} value={totalCount.toString()} icon={Truck} />
      </div>

      <div className="h-px bg-border" />

      <p className="text-xs text-muted-foreground">{t("sampleHint")}</p>
      {/* Goods receipt table */}
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Tabs value={statusFilter} onValueChange={setStatusFilter}>
            <TabsList className="overflow-x-auto">
              <TabsTrigger value="all" className="whitespace-nowrap">{t("all")}</TabsTrigger>
              <TabsTrigger value="received" className="whitespace-nowrap">{t("receivedTab")}</TabsTrigger>
              <TabsTrigger value="billed" className="whitespace-nowrap" title={t("billedHint")}>{t("billedTab")}</TabsTrigger>
              <TabsTrigger value="void" className="whitespace-nowrap">{t("cancelledTab")}</TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Goods are received from a purchase order — no "new" here. */}
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Truck className="size-3.5 shrink-0" />
            {t("receivedFrom")}{" "}
            <Link href="/purchases/orders" className="underline underline-offset-2 hover:text-foreground">
              {t("purchaseOrder")}
            </Link>
          </p>
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
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground shrink-0">{t("from")}</span>
            <DatePicker
              value={dateFrom}
              onChange={(v) => setDateFrom(v)}
              placeholder={t("startDate")}
              className="h-8 w-40 text-xs"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground shrink-0">{t("to")}</span>
            <DatePicker
              value={dateTo}
              onChange={(v) => setDateTo(v)}
              placeholder={t("endDate")}
              className="h-8 w-40 text-xs"
            />
          </div>
          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs text-muted-foreground"
              onClick={() => { setSearch(""); setDateFrom(""); setDateTo(""); }}
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
              data={filteredReceipts}
              loading={false}
              emptyMessage={t("noMatches")}
              onRowClick={(r) => router.push(`/purchases/goods-receipts/${r.id}`)}
              sortBy={sortBy}
              sortOrder={sortOrder}
              onSort={handleSort}
            />
          </ContentReveal>
        )}

        {/* Infinite scroll sentinel & count */}
        {!refetching && !pendingSearch && filteredReceipts.length > 0 && (
          <>
            <div className="flex items-center justify-between pt-1">
              <p className="text-xs text-muted-foreground">
                {t("showing", { loaded: receipts.length, total: totalCount })}
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
