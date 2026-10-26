"use client";

import { bankMoneyDisplay as exampleMoney } from "@/lib/money/bank-display";
import { BidiText, IdentifierText } from "@/components/ui/bidi-text";
import { localeDirection } from "@/i18n/locale";
import { usePresentation } from "@/i18n/provider";
import type { NumberPresentation } from "@/i18n/numbers";
import { useTranslations } from "next-intl";
import { customerPrepaymentStatusLabel, customerPrepaymentSourceLabel, type CustomerPrepaymentTranslate } from "@/i18n/customer-prepayment-presentation";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useDebounce } from "@/lib/hooks/use-debounce";
import { useRouter } from "next/navigation";
import { Plus, Wallet, ReceiptText, X, Search, Loader2 } from "lucide-react";
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
import { customerPrepaymentRow, customerPrepaymentMoney as formatMoney, customerPrepaymentSummary } from "@/lib/money/customer-prepayment-ui";
import { devDelay } from "@/lib/dev-delay";
import { useCreateDrawer } from "@/components/dashboard/create-drawer";
import { useDocumentTitle } from "@/lib/hooks/use-document-title";
import { BrandLoader } from "@/components/dashboard/brand-loader";
import { ContentReveal } from "@/components/ui/content-reveal";

interface CustomerCredit {
  id: string;
  date: string;
  status: string;
  originalAmount: bigint;
  amountRemaining: bigint;
  sourceType: string;
  currencyCode: string;
  contact: { name: string } | null;
}

const statusColors: Record<string, string> = {
  open: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300",
  applied:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  refunded:
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300",
  void: "border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-300",
};

function buildColumns(t: CustomerPrepaymentTranslate, unitPresentation: NumberPresentation = { locale: "en-US", numerals: "latn" }): Column<CustomerCredit>[] {
  return [
    {
      key: "date",
      header: t("date"),
      sortKey: "date",
      className: "w-28",
      render: (r) => <span className="text-sm"><IdentifierText>{r.date}</IdentifierText></span>,
    },
    {
      key: "contact",
      header: t("customer"),
      render: (r) => (
        <span className="text-sm font-medium"><BidiText>{r.contact?.name || "-"}</BidiText></span>
      ),
    },
    {
      key: "source",
      header: t("source"),
      className: "w-36",
      render: (r) => (
        <span className="text-sm text-muted-foreground">
          <BidiText>{customerPrepaymentSourceLabel(t, r.sourceType)}</BidiText>
        </span>
      ),
    },
    {
      key: "status",
      header: t("status"),
      className: "w-24",
      render: (r) => (
        <Badge variant="outline" className={statusColors[r.status] || ""}>
          <BidiText>{customerPrepaymentStatusLabel(t, r.status)}</BidiText>
        </Badge>
      ),
    },
    {
      key: "amount",
      header: t("original"),
      sortKey: "amount",
      className: "w-28 text-end",
      render: (r) => (
        <span className="font-mono text-sm tabular-nums break-all">
          <BidiText>{formatMoney(r.originalAmount, r.currencyCode, unitPresentation)}</BidiText>
        </span>
      ),
    },
    {
      key: "remaining",
      header: t("remaining"),
      sortKey: "remaining",
      className: "w-28 text-end",
      render: (r) => (
        <span className="font-mono text-sm tabular-nums break-all">
          <BidiText>{formatMoney(r.amountRemaining, r.currencyCode, unitPresentation)}</BidiText>
        </span>
      ),
    },
  ];
}

export default function CustomerPrepaymentsPage() {
  const orgId = typeof window !== "undefined" ? localStorage.getItem("activeOrgId") : null;
  return <CustomerPrepaymentsList key={orgId} orgId={orgId} />;
}

function CustomerPrepaymentsList({ orgId }: { orgId: string | null }) {
  const unitPresentation = usePresentation();
  const t = useTranslations("CustomerPrepayments");
  const router = useRouter();
  const { open: openDrawer } = useCreateDrawer();
  const [credits, setCredits] = useState<CustomerCredit[]>([]);
  const [readError, setReadError] = useState<"" | "readFailed" | "moreFailed">("");
  const generation = useRef(0);
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

  useDocumentTitle(t("pageTitle"));

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const PAGE_SIZE = 50;

  const columns = useMemo(() => buildColumns(t, unitPresentation), [t, unitPresentation]);

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

  // Fetch first page when filters change
  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;
    generation.current += 1;
    const controller = new AbortController();
    setRefetching(true);
    setPage(1);
    setReadError("");
    setLoadingMore(false);

    fetch(`/api/v1/customer-credits?${buildParams(1)}`, {
      headers: { "x-organization-id": orgId },
      signal: controller.signal,
    })
      .then((r) => { if (!r.ok) throw new Error("Unable to load prepayments"); return r.json(); })
      .then((data) => {
        if (cancelled) return;
        if (!Array.isArray(data.data)) throw new Error("Invalid prepayment response");
        setCredits(data.data.map(customerPrepaymentRow));
        setTotalCount(data.pagination?.total || 0);
      })
      .then(() => devDelay())
      .catch(() => { if (!cancelled) { setCredits([]); setReadError("readFailed"); } })
      .finally(() => { if (!cancelled) { setInitialLoad(false); setRefetching(false); setFetchKey((k) => k + 1); } });

    return () => { cancelled = true; controller.abort(); generation.current += 1; };
  }, [orgId, buildParams]);

  // Load more
  const loadMore = useCallback(() => {
    if (!orgId || loadingMore || refetching || readError) return;
    const nextPage = page + 1;
    const current = generation.current;
    setLoadingMore(true);

    fetch(`/api/v1/customer-credits?${buildParams(nextPage)}`, {
      headers: { "x-organization-id": orgId },
    })
      .then((r) => { if (!r.ok) throw new Error("Unable to load prepayments"); return r.json(); })
      .then((data) => {
        if (current !== generation.current) return;
        if (!Array.isArray(data.data)) throw new Error("Invalid prepayment response");
        const rows = data.data.map(customerPrepaymentRow);
        setCredits((prev) => [...prev, ...rows]);
        setPage(nextPage);
      })
      .catch(() => { if (current === generation.current) setReadError("moreFailed"); })
      .finally(() => { if (current === generation.current) setLoadingMore(false); });
  }, [orgId, page, buildParams, loadingMore, refetching, readError]);

  const hasMore = credits.length < totalCount;
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Infinite scroll
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !refetching && !readError) loadMore();
      },
      { rootMargin: "200px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore, refetching, readError]);

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
  const filteredCredits = useMemo(() => {
    if (!debouncedSearch) return credits;
    const q = debouncedSearch.toLowerCase();
    return credits.filter(
      (c) =>
        (c.contact?.name || "").toLowerCase().includes(q) ||
        customerPrepaymentSourceLabel(t, c.sourceType).toLowerCase().includes(q)
    );
  }, [credits, debouncedSearch, t]);

  // Bump searchKey when debounced search changes to trigger ContentReveal
  useEffect(() => {
    setSearchKey((k) => k + 1);
  }, [debouncedSearch]);

  const totals = useMemo(() => customerPrepaymentSummary(credits, unitPresentation), [credits, unitPresentation]);

  if (initialLoad) return <BrandLoader />;

  if (!readError && !initialLoad && !refetching && credits.length === 0 && statusFilter === "all" && !hasFilters) {
    return (
      <ContentReveal>
        <div className="pt-12 pb-12 space-y-10">
          {/* Top: title + CTA */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">{t("prepayments")}</h2>
              <p className="mt-1 text-sm text-muted-foreground max-w-md">
                {t("emptyDescription")}
              </p>
            </div>
            <Button
              onClick={() => openDrawer("customerCredit")}
              className="bg-emerald-600 hover:bg-emerald-700 h-auto whitespace-normal max-w-full shrink-0"
            >
              <Plus className="me-2 size-4" />
              {t("newPrepayment")}
            </Button>
          </div>

          <div className="grid gap-6 sm:gap-8 grid-cols-1 lg:grid-cols-[1fr_1fr] items-start">
            {/* Left: how it works */}
            <div className="rounded-xl border bg-card overflow-hidden">
              <div className="bg-muted/30 px-3 sm:px-5 py-3 border-b">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("howItWorks")}</p>
              </div>
              <div className="divide-y">
                <div className="flex flex-wrap items-center justify-between gap-3 px-3 sm:px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className="flex size-7 items-center justify-center rounded-md bg-emerald-50 dark:bg-emerald-950/40">
                      <Wallet className="size-3.5 text-emerald-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">{t("paidEarly")}</p>
                      <p className="text-[11px] text-muted-foreground">{t("creditOnAccount")}</p>
                    </div>
                  </div>
                  <span className="font-mono text-sm font-medium text-emerald-600 dark:text-emerald-400"><BidiText>{"+" + exampleMoney(50000n, "USD", unitPresentation)}</BidiText></span>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 px-3 sm:px-5 py-3.5 bg-blue-50/30 dark:bg-blue-950/10">
                  <div className="flex items-center gap-3">
                    <div className="flex size-7 items-center justify-center rounded-md bg-blue-50 dark:bg-blue-950/40">
                      <ReceiptText className="size-3.5 text-blue-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{t("putTowardsInvoice")}</p>
                      <p className="text-[11px] text-muted-foreground"><IdentifierText>INV-0042</IdentifierText></p>
                    </div>
                  </div>
                  <span className="font-mono text-sm font-medium"><BidiText>{exampleMoney(-30000n, "USD", unitPresentation)}</BidiText></span>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 px-3 sm:px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className="size-7" />
                    <p className="text-sm font-semibold">{t("creditLeft")}</p>
                  </div>
                  <span className="font-mono text-sm font-bold"><BidiText>{exampleMoney(20000n, "USD", unitPresentation)}</BidiText></span>
                </div>
              </div>
            </div>

            {/* Right: Use cases */}
            <div className="space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("whenToUse")}</p>
              {[
                {
                  title: t("depositTitle"),
                  desc: t("depositDescription"),
                  color: "border-s-emerald-400",
                },
                {
                  title: t("overpaidTitle"),
                  desc: t("overpaidDescription"),
                  color: "border-s-blue-400",
                },
                {
                  title: t("retainerTitle"),
                  desc: t("retainerDescription"),
                  color: "border-s-amber-400",
                },
                {
                  title: t("laterTitle"),
                  desc: t("laterDescription"),
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
    <ContentReveal className="min-w-0 space-y-6 [overflow-wrap:anywhere]">
      {/* Top: Stats */}
      <div className="grid gap-3 sm:grid-cols-3 [overflow-wrap:anywhere]">
        <StatCard title={t("receivedLoaded")} value={readError ? "—" : totals.received} icon={Wallet} />
        <StatCard title={t("availableLoaded")} value={readError ? "—" : totals.remaining} icon={Wallet} />
        <StatCard title={t("prepayments")} value={totalCount.toString()} icon={ReceiptText} />
      </div>

      {readError && <p role="alert" className="text-sm text-destructive">{t(readError)}</p>}

      <div className="h-px bg-border" />

      {/* Prepayment table */}
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Tabs dir={localeDirection(unitPresentation.locale)} className="min-w-0 max-w-full" value={statusFilter} onValueChange={setStatusFilter}>
            <TabsList className="max-w-full overflow-x-auto">
              <TabsTrigger value="all" className="whitespace-nowrap">{t("all")}</TabsTrigger>
              <TabsTrigger value="open" className="whitespace-nowrap" title={t("availableHint")}>{t("available")}</TabsTrigger>
              <TabsTrigger value="applied" className="whitespace-nowrap" title={t("usedHint")}>{t("used")}</TabsTrigger>
              <TabsTrigger value="void" className="whitespace-nowrap">{t("cancelled")}</TabsTrigger>
            </TabsList>
          </Tabs>

          <Button
            onClick={() => openDrawer("customerCredit")}
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-700 h-auto whitespace-normal max-w-full"
          >
            <Plus className="me-2 size-4" />
            {t("newPrepayment")}
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-0 max-w-full">
            <Search className="absolute start-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              dir="auto"
              aria-label={t("search")}
              placeholder={t("search")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 w-56 max-w-full ps-8 text-xs"
            />
          </div>
          <div role="group" aria-label={t("startDate")} className="flex max-w-full items-center gap-1.5">
            <span className="text-xs text-muted-foreground shrink-0">{t("from")}</span>
            <DatePicker
              value={dateFrom}
              onChange={(v) => setDateFrom(v)}
              placeholder={t("startDate")}
              className="h-8 w-40 text-xs"
            />
          </div>
          <div role="group" aria-label={t("endDate")} className="flex max-w-full items-center gap-1.5">
            <span className="text-xs text-muted-foreground shrink-0">{t("to")}</span>
            <DatePicker
              value={dateTo}
              onChange={(v) => setDateTo(v)}
              placeholder={t("endDate")}
              className="h-8 w-40 text-xs"
            />
          </div>
          <Select
            dir={localeDirection(unitPresentation.locale)}
            value={`${sortBy}:${sortOrder}`}
            onValueChange={(v) => {
              const [key, order] = v.split(":");
              setSortBy(key);
              setSortOrder(order as "asc" | "desc");
            }}
          >
            <SelectTrigger aria-label={t("sortBy")} className="h-auto min-h-8 w-44 max-w-full whitespace-normal text-start text-xs *:data-[slot=select-value]:line-clamp-none">
              <SelectValue placeholder={t("sortBy")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="created:desc">{t("newest")}</SelectItem>
              <SelectItem value="created:asc">{t("oldest")}</SelectItem>
              <SelectItem value="amount:desc">{t("highest")}</SelectItem>
              <SelectItem value="amount:asc">{t("lowest")}</SelectItem>
              <SelectItem value="remaining:desc">{t("mostRemaining")}</SelectItem>
              <SelectItem value="remaining:asc">{t("leastRemaining")}</SelectItem>
            </SelectContent>
          </Select>
          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs text-muted-foreground"
              onClick={() => { setSearch(""); setDateFrom(""); setDateTo(""); }}
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
              data={filteredCredits}
              loading={false}
              emptyMessage={t("noMatches")}
              onRowClick={(r) => router.push(`/sales/customer-prepayments/${r.id}`)}
              sortBy={sortBy}
              sortOrder={sortOrder}
              onSort={handleSort}
            />
          </ContentReveal>
        )}

        {/* Infinite scroll sentinel & count */}
        {!refetching && !pendingSearch && filteredCredits.length > 0 && (
          <>
            <div className="flex items-center justify-between pt-1">
              <p className="text-xs text-muted-foreground">
                {t("showing", { loaded: credits.length, total: totalCount })}
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
