"use client";

import { usePresentation } from "@/i18n/provider";
import { useTranslations } from "next-intl";
import { requireAccountResponse, accountFailureMessage } from "@/i18n/account-presentation";

import { useState, useEffect, useCallback, useRef } from "react";
import { useDebounce } from "@/lib/hooks/use-debounce";
import { useParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { motion, MotionConfig } from "motion/react";
import { DataTable, type Column } from "@/components/dashboard/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BidiText, IdentifierText } from "@/components/ui/bidi-text";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDocumentTitle } from "@/lib/hooks/use-document-title";
import { coreLedgerMoney, coreStoredMinor, type LedgerMoney } from "@/lib/money/core-presentation";
import { journalMoney } from "@/lib/money/journal-display";

interface LedgerEntry extends LedgerMoney {
  entryId: string;
  entryNumber: number;
  date: string;
  description: string;
}

export default function AccountLedgerPage() {
  const unitPresentation = usePresentation();
  const t = useTranslations("Accounts");
  const errors = useTranslations("AccountErrors");
  const ledgerColumns: Column<LedgerEntry>[] = [
    {
      key: "number",
      header: "#",
      className: "w-16",
      render: (r) => (
        <a
          href={`/accounting/${r.entryId}`}
          className="font-mono text-xs text-emerald-600 hover:underline"
        >
          <IdentifierText>{r.entryNumber}</IdentifierText>
        </a>
      ),
    },
    {
      key: "date",
      header: t("date"),
      className: "w-28",
      render: (r) => <IdentifierText className="text-sm">{r.date}</IdentifierText>,
    },
    {
      key: "description",
      header: t("description"),
      render: (r) => <BidiText className="text-sm whitespace-normal">{r.description}</BidiText>,
    },
    {
      key: "debit",
      header: t("debit"),
      className: "w-28 text-end",
      render: (r) => (
        <BidiText className="font-mono text-sm tabular-nums">
          {r.debitAmountMinor !== "0" ? journalMoney(coreStoredMinor(r.debitAmount, r.debitAmountMinor), r.amountCurrencyCode, unitPresentation) : ""}
        </BidiText>
      ),
    },
    {
      key: "credit",
      header: t("credit"),
      className: "w-28 text-end",
      render: (r) => (
        <BidiText className="font-mono text-sm tabular-nums">
          {r.creditAmountMinor !== "0" ? journalMoney(coreStoredMinor(r.creditAmount, r.creditAmountMinor), r.amountCurrencyCode, unitPresentation) : ""}
        </BidiText>
      ),
    },
    {
      key: "balance",
      header: t("balance"),
      className: "w-28 text-end",
      render: (r) => (
        <BidiText className="font-mono text-sm font-medium tabular-nums">
          {journalMoney(coreStoredMinor(r.balance, r.balanceMinor), r.amountCurrencyCode, unitPresentation)}
        </BidiText>
      ),
    },
  ];
  const { id } = useParams<{ id: string }>();
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sort, setSort] = useState("date:desc");
  const [entryType, setEntryType] = useState("all");

  const [refetching, setRefetching] = useState(false);
  const [fetchKey, setFetchKey] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const orgId = typeof window !== "undefined" ? localStorage.getItem("activeOrgId") : null;

  useDocumentTitle(t("ledgerTitle"));

  const pendingSearch = search !== debouncedSearch;

  const buildParams = useCallback((pageNum: number) => {
    const [sortBy, sortOrder] = sort.split(":");
    const params = new URLSearchParams();
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (dateFrom) params.set("from", dateFrom);
    if (dateTo) params.set("to", dateTo);
    if (entryType !== "all") params.set("entryType", entryType);
    if (sortBy !== "date") params.set("sortBy", sortBy);
    if (sortOrder !== "desc") params.set("sortOrder", sortOrder);
    params.set("page", String(pageNum));
    params.set("limit", "50");
    return params;
  }, [debouncedSearch, dateFrom, dateTo, entryType, sort]);

  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;
    const isRefetch = !loading;
    setPage(1);
    setHasMore(true);
    if (isRefetch) setRefetching(true);

    fetch(`/api/v1/accounts/${id}?${buildParams(1)}`, {
      headers: { "x-organization-id": orgId },
    })
      .then(async (r) => { return (await requireAccountResponse(r, errors, t("invalidLedgerAmounts"))).json(); })
      .then((data) => {
        if (cancelled) return;
        setLedger(data.data.map(coreLedgerMoney));
        setError(null);
        if (data.pagination) {
          setTotal(data.pagination.total);
          setHasMore(data.pagination.page < data.pagination.totalPages);
        }
      })
      .catch((err) => { if (!cancelled) { setLedger([]); setHasMore(false); setError(accountFailureMessage(err, t("invalidLedgerAmounts"))); } })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
          setRefetching(false);
          setFetchKey((k) => k + 1);
        }
      });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, debouncedSearch, dateFrom, dateTo, entryType, sort]);

  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore || !orgId) return;
    const nextPage = page + 1;
    setLoadingMore(true);

    fetch(`/api/v1/accounts/${id}?${buildParams(nextPage)}`, {
      headers: { "x-organization-id": orgId },
    })
      .then(async (r) => { return (await requireAccountResponse(r, errors, t("invalidLedgerAmounts"))).json(); })
      .then((data) => {
        const rows: LedgerEntry[] = data.data.map(coreLedgerMoney);
        setLedger((prev) => [...prev, ...rows]);
        setError(null);
        if (data.pagination) {
          setPage(data.pagination.page);
          setTotal(data.pagination.total);
          setHasMore(data.pagination.page < data.pagination.totalPages);
        }
      })
      .catch((err) => { setLedger([]); setHasMore(false); setError(accountFailureMessage(err, t("invalidLedgerAmounts"))); })
      .finally(() => setLoadingMore(false));
  }, [loadingMore, hasMore, page, id, orgId, buildParams, t, errors]);

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

  const hasFilters = search || dateFrom || dateTo || entryType !== "all";

  return (
    <div className="space-y-3">
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{t("transactions")}</h3>
        <span className="text-xs text-muted-foreground tabular-nums">{t("entryCount", { count: total })}</span>
      </div>

      <Tabs dir={unitPresentation.locale === "fa-IR" ? "rtl" : "ltr"} value={entryType} onValueChange={setEntryType}>
        <TabsList aria-label={t("transactions")} className="h-auto max-w-full flex-wrap group-data-[orientation=horizontal]/tabs:h-auto [&_[role=tab]]:h-auto [&_[role=tab]]:whitespace-normal">
          <TabsTrigger value="all">{t("all")}</TabsTrigger>
          <TabsTrigger
            value="debits"
            title={t("debitHint")}
          >
            {t("debits")}
          </TabsTrigger>
          <TabsTrigger
            value="credits"
            title={t("creditHint")}
          >
            {t("credits")}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:max-w-xs">
          <Search aria-hidden="true" className="absolute start-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder={t("searchLedger")}
            aria-label={t("searchLedger")}
            dir="auto"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="ps-9"
          />
        </div>
        <div role="group" aria-label={t("startDate")} className="flex max-w-full flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground shrink-0">{t("from")}</span>
          <DatePicker
            value={dateFrom}
            onChange={(v) => setDateFrom(v)}
            placeholder={t("startDate")}
            className="h-8 w-40 max-w-full text-xs"
          />
        </div>
        <div role="group" aria-label={t("endDate")} className="flex max-w-full flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground shrink-0">{t("to")}</span>
          <DatePicker
            value={dateTo}
            onChange={(v) => setDateTo(v)}
            placeholder={t("endDate")}
            className="h-8 w-40 max-w-full text-xs"
          />
        </div>
        <Select value={sort} onValueChange={setSort}>
          <SelectTrigger aria-label={t("sortBy")} className="min-h-8 h-auto max-w-full w-44 text-xs whitespace-normal data-[size=default]:h-auto *:data-[slot=select-value]:line-clamp-none">
            <SelectValue placeholder={t("sortBy")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="date:desc">{t("newestFirst")}</SelectItem>
            <SelectItem value="date:asc">{t("oldestFirst")}</SelectItem>
            <SelectItem value="number:desc">{t("numberDesc")}</SelectItem>
            <SelectItem value="number:asc">{t("numberAsc")}</SelectItem>
            <SelectItem value="amount:desc">{t("largestAmount")}</SelectItem>
            <SelectItem value="amount:asc">{t("smallestAmount")}</SelectItem>
          </SelectContent>
        </Select>
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            className="h-auto min-h-8 max-w-full whitespace-normal text-xs text-muted-foreground"
            onClick={() => {
              setSearch("");
              setDateFrom("");
              setDateTo("");
              setEntryType("all");
            }}
          >
            <X className="me-1 size-3" />
            {t("clearFilters")}
          </Button>
        )}
      </div>

      {refetching || pendingSearch ? (
        <div className="flex items-center justify-center py-20">
          <div className="brand-loader" aria-label={t("loading")}>
            <div className="brand-loader-circle brand-loader-circle-1" />
            <div className="brand-loader-circle brand-loader-circle-2" />
          </div>
        </div>
      ) : (
        <MotionConfig reducedMotion="never">
          <motion.div
            key={fetchKey}
            initial={{ opacity: 0, y: 12, filter: "blur(10px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ duration: 0.8, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
            style={{ willChange: "opacity, transform, filter" }}
            className="overflow-x-auto"
          >
            <DataTable
              columns={ledgerColumns}
              data={ledger}
              emptyMessage={hasFilters ? t("noMatchingEntries") : t("noTransactions")}
            />
          </motion.div>
        </MotionConfig>
      )}

      {hasMore && !refetching && <div ref={sentinelRef} className="h-1" />}
      {loadingMore && (
        <div className="flex items-center justify-center py-4">
          <div className="brand-loader" aria-label={t("loadingMore")}>
            <div className="brand-loader-circle brand-loader-circle-1" />
            <div className="brand-loader-circle brand-loader-circle-2" />
          </div>
        </div>
      )}
    </div>
  );
}
