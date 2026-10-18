"use client";

import { useTranslations } from "next-intl";
import { salesReceiptStatusLabel, type SalesReceiptTranslate } from "@/i18n/sales-receipt-presentation";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useDebounce } from "@/lib/hooks/use-debounce";
import { useRouter } from "next/navigation";
import { Plus, Banknote, ReceiptText, X, Search, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { DataTable, type Column } from "@/components/dashboard/data-table";
import { StatCard } from "@/components/dashboard/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { salesReceiptUiHeader, salesReceiptUiMoney, salesReceiptUiCollected } from "@/lib/money/sales-receipt-ui";
import { devDelay } from "@/lib/dev-delay";
import { useCreateDrawer } from "@/components/dashboard/create-drawer";
import { useDocumentTitle } from "@/lib/hooks/use-document-title";
import { BrandLoader } from "@/components/dashboard/brand-loader";
import { ContentReveal } from "@/components/ui/content-reveal";

interface SalesReceipt {
  id: string;
  receiptNumber: string;
  date: string;
  status: string;
  subtotal: bigint;
  taxTotal: bigint;
  total: bigint;
  currencyCode: string;
  contact: { name: string } | null;
}

interface SalesReceiptWire extends Omit<SalesReceipt, "subtotal" | "taxTotal" | "total"> {
  subtotal: number; taxTotal: number; total: number;
  [key: string]: unknown;
}

const statusColors: Record<string, string> = {
  draft: "",
  paid: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  void: "border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-300",
};

// Finite display labels; filter and transport codes stay canonical.
function buildColumns(t: SalesReceiptTranslate): Column<SalesReceipt>[] {
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
      header: t("customer"),
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
          {salesReceiptStatusLabel(t, r.status)}
        </Badge>
      ),
    },
    {
      key: "total",
      header: t("total"),
      sortKey: "total",
      className: "w-28 text-right",
      render: (r) => (
        <span className="font-mono text-sm tabular-nums">
          {salesReceiptUiMoney(r.total, r.currencyCode)}
        </span>
      ),
    },
  ];
}

export default function SalesReceiptsPage() {
  const t = useTranslations("SalesReceipts");
  const router = useRouter();
  const { open: openDrawer } = useCreateDrawer();
  const [loaded, setLoaded] = useState<{ context: string; receipts: SalesReceipt[]; total: number; error: string | null } | null>(null);
  const [initialLoad, setInitialLoad] = useState(true);
  const [refetching, setRefetching] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const generation = useRef(0);
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

  const context = `${orgId}:${statusFilter}:${sortBy}:${sortOrder}:${dateFrom}:${dateTo}`;
  const receipts = useMemo(() => loaded?.context === context ? loaded.receipts : [], [loaded, context]);
  const totalCount = loaded?.context === context ? loaded.total : 0;
  const error = loaded?.context === context ? loaded.error : null;
  const waitingForContext = !!orgId && loaded?.context !== context;
  const columns = useMemo(() => buildColumns(t), [t]);

  const buildParams = useCallback((p: number) => {
    const params = new URLSearchParams();
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (sortBy !== "created") params.set("sortBy", sortBy);
    if (sortOrder !== "desc") params.set("sortOrder", sortOrder);
    if (dateFrom) params.set("from", dateFrom);
    if (dateTo) params.set("to", dateTo);
    params.set("page", String(p));
    params.set("limit", String(PAGE_SIZE));
    return params;
  }, [statusFilter, sortBy, sortOrder, dateFrom, dateTo]);

  // Invalidate pagination whenever the organization or server filters change.
  useEffect(() => {
    const controller = new AbortController();
    const current = ++generation.current;
    if (!orgId) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRefetching(true); setLoadingMore(false); setPage(1);
    fetch(`/api/v1/sales-receipts?${buildParams(1)}`, {
      headers: { "x-organization-id": orgId }, signal: controller.signal,
    })
      .then(r => { if (!r.ok) throw new Error("Unable to load cash sales"); return r.json(); })
      .then(data => {
        if (!Array.isArray(data.data)) throw new Error("Invalid cash sale list");
        const rows = data.data.map((row: SalesReceiptWire) => salesReceiptUiHeader(row));
        if (!controller.signal.aborted) setLoaded({ context, receipts: rows, total: data.pagination?.total || 0, error: null });
      })
      .catch(() => { if (!controller.signal.aborted) setLoaded({ context, receipts: [], total: 0, error: t("readFailed") }); })
      .then(() => devDelay())
      .finally(() => { if (!controller.signal.aborted && generation.current === current) { setInitialLoad(false); setRefetching(false); setFetchKey(k => k + 1); } });
    return () => controller.abort();
  }, [orgId, buildParams, context, t]);

  const loadMore = useCallback(() => {
    if (!orgId || loadingMore || waitingForContext) return;
    const nextPage = page + 1, current = generation.current;
    setLoadingMore(true);
    fetch(`/api/v1/sales-receipts?${buildParams(nextPage)}`, { headers: { "x-organization-id": orgId } })
      .then(r => { if (!r.ok) throw new Error("Unable to load more cash sales"); return r.json(); })
      .then(data => {
        if (!Array.isArray(data.data)) throw new Error("Invalid cash sale list");
        const rows = data.data.map((row: SalesReceiptWire) => salesReceiptUiHeader(row));
        if (generation.current !== current) return;
        setLoaded(prev => prev?.context === context ? { ...prev, receipts: [...prev.receipts, ...rows], error: null } : prev);
        setPage(nextPage);
      })
      .catch(() => { if (generation.current === current) setLoaded(prev => prev?.context === context ? { ...prev, error: t("moreFailed") } : prev); })
      .finally(() => { if (generation.current === current) setLoadingMore(false); });
  }, [orgId, page, buildParams, loadingMore, waitingForContext, context, t]);

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
  const filteredReceipts = useMemo(() => {
    if (!debouncedSearch) return receipts;
    const q = debouncedSearch.toLowerCase();
    return receipts.filter(
      (r) =>
        r.receiptNumber.toLowerCase().includes(q) ||
        (r.contact?.name || "").toLowerCase().includes(q)
    );
  }, [receipts, debouncedSearch]);

  // Bump searchKey when debounced search changes to trigger ContentReveal
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSearchKey((k) => k + 1);
  }, [debouncedSearch]);

  const totalCollected = useMemo(() => salesReceiptUiCollected(filteredReceipts), [filteredReceipts]);

  if (initialLoad || waitingForContext) return <BrandLoader />;

  if (!error && !initialLoad && !refetching && receipts.length === 0 && statusFilter === "all" && !hasFilters) {
    return (
      <ContentReveal>
        <div className="pt-12 pb-12 space-y-10">
          {/* Top: title + CTA */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">{t("cashSales")}</h2>
              <p className="mt-1 text-sm text-muted-foreground max-w-md">
                {t("emptyDescription")}
              </p>
            </div>
            <Button
              onClick={() => openDrawer("salesReceipt")}
              className="bg-emerald-600 hover:bg-emerald-700 shrink-0"
            >
              <Plus className="mr-2 size-4" />
              {t("newCashSale")}
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
                      <ReceiptText className="size-3.5 text-blue-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{t("saleTotal")}</p>
                      <p className="text-[11px] text-muted-foreground">SR-0001</p>
                    </div>
                  </div>
                  <span className="font-mono text-sm font-medium">$45.00</span>
                </div>
                <div className="flex items-center justify-between px-3 sm:px-5 py-3.5 bg-emerald-50/30 dark:bg-emerald-950/10">
                  <div className="flex items-center gap-3">
                    <div className="flex size-7 items-center justify-center rounded-md bg-emerald-50 dark:bg-emerald-950/40">
                      <Banknote className="size-3.5 text-emerald-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">{t("paidInto")}</p>
                      <p className="text-[11px] text-muted-foreground">{t("cashDrawer")}</p>
                    </div>
                  </div>
                  <span className="font-mono text-sm font-medium text-emerald-600 dark:text-emerald-400">+$45.00</span>
                </div>
                <div className="flex items-center justify-between px-3 sm:px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className="size-7" />
                    <p className="text-sm font-semibold">{t("nothingOwed")}</p>
                  </div>
                  <span className="font-mono text-sm font-bold">$0.00</span>
                </div>
              </div>
            </div>

            {/* Right: Use cases */}
            <div className="space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("whenToUse")}</p>
              {[
                {
                  title: t("counterTitle"),
                  desc: t("counterDescription"),
                  color: "border-l-emerald-400",
                },
                {
                  title: t("marketTitle"),
                  desc: t("marketDescription"),
                  color: "border-l-blue-400",
                },
                {
                  title: t("serviceTitle"),
                  desc: t("serviceDescription"),
                  color: "border-l-amber-400",
                },
                {
                  title: t("noInvoiceTitle"),
                  desc: t("noInvoiceDescription"),
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
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {/* Top: Stats */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="min-w-0 [&_.font-mono]:break-all [&_.space-y-1]:min-w-0"><StatCard title={t("collected")} value={totalCollected} icon={Banknote} /></div>
        <StatCard title={t("cashSalesCount")} value={totalCount.toString()} icon={ReceiptText} />
      </div>

      <div className="h-px bg-border" />

      {/* Sales receipt table */}
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Tabs value={statusFilter} onValueChange={setStatusFilter}>
            <TabsList className="overflow-x-auto">
              <TabsTrigger value="all" className="whitespace-nowrap">{t("all")}</TabsTrigger>
              <TabsTrigger value="draft" className="whitespace-nowrap">{t("draftHeading")}</TabsTrigger>
              <TabsTrigger value="paid" className="whitespace-nowrap">{t("paidHeading")}</TabsTrigger>
              <TabsTrigger value="void" className="whitespace-nowrap">{t("cancelledHeading")}</TabsTrigger>
            </TabsList>
          </Tabs>

          <Button
            onClick={() => openDrawer("salesReceipt")}
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            <Plus className="mr-2 size-4" />
            {t("newCashSale")}
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
          <Select
            value={`${sortBy}:${sortOrder}`}
            onValueChange={(v) => {
              const [key, order] = v.split(":");
              setSortBy(key);
              setSortOrder(order as "asc" | "desc");
            }}
          >
            <SelectTrigger className="h-8 w-44 text-xs">
              <SelectValue placeholder={t("sortBy")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="created:desc">{t("newest")}</SelectItem>
              <SelectItem value="created:asc">{t("oldest")}</SelectItem>
              <SelectItem value="total:desc">{t("highest")}</SelectItem>
              <SelectItem value="total:asc">{t("lowest")}</SelectItem>
              <SelectItem value="number:desc">{t("numberDesc")}</SelectItem>
              <SelectItem value="number:asc">{t("numberAsc")}</SelectItem>
            </SelectContent>
          </Select>
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
              onRowClick={(r) => router.push(`/sales/receipts/${r.id}`)}
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
