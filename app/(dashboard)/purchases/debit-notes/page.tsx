"use client";

import { BidiText, IdentifierText } from "@/components/ui/bidi-text";
import { localeDirection } from "@/i18n/locale";

import { bankMoneyDisplay as exampleMoney } from "@/lib/money/bank-display";
import { usePresentation } from "@/i18n/provider";
import type { NumberPresentation } from "@/i18n/numbers";
import { useTranslations } from "next-intl";
import { debitNoteStatusLabel, type DebitNoteTranslate } from "@/i18n/debit-note-presentation";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useDebounce } from "@/lib/hooks/use-debounce";
import { useRouter } from "next/navigation";
import { Plus, CreditCard, ReceiptText, X, Search, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { DataTable, type Column } from "@/components/dashboard/data-table";
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
import { debitNoteUiHeader, debitNoteUiMoney, debitNoteUiOverview } from "@/lib/money/debit-note-ui";
import { DebitNoteOverview } from "@/components/dashboard/debit-note-overview";
import { useCreateDrawer } from "@/components/dashboard/create-drawer";
import { useDocumentTitle } from "@/lib/hooks/use-document-title";
import { BrandLoader } from "@/components/dashboard/brand-loader";
import { ContentReveal } from "@/components/ui/content-reveal";

interface DebitNote {
  id: string;
  debitNoteNumber: string;
  issueDate: string;
  status: string;
  subtotal: bigint;
  taxTotal: bigint;
  total: bigint;
  amountApplied: bigint;
  amountRemaining: bigint;
  currencyCode: string;
  contact: { name: string } | null;
}

type DebitNoteWire = Omit<DebitNote, "subtotal" | "taxTotal" | "total" | "amountApplied" | "amountRemaining"> & {
  subtotal: number; taxTotal: number; total: number; amountApplied: number; amountRemaining: number; [key: string]: unknown;
};

const statusColors: Record<string, string> = {
  draft: "",
  sent: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300",
  applied:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  void: "border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-300",
};

function buildColumns(t: DebitNoteTranslate, unitPresentation: NumberPresentation = { locale: "en-US", numerals: "latn" }): Column<DebitNote>[] {
  return [
    {
      key: "number",
      header: t("number"),
      sortKey: "number",
      className: "w-32",
      render: (r) => (
        <span className="font-mono text-sm"><IdentifierText>{r.debitNoteNumber}</IdentifierText></span>
      ),
    },
    {
      key: "contact",
      header: t("supplier"),
      render: (r) => (
        <span className="text-sm font-medium"><BidiText>{r.contact?.name || "-"}</BidiText></span>
      ),
    },
    {
      key: "date",
      header: t("date"),
      sortKey: "date",
      className: "w-28",
      render: (r) => <span className="text-sm"><IdentifierText>{r.issueDate}</IdentifierText></span>,
    },
    {
      key: "status",
      header: t("status"),
      className: "w-24",
      render: (r) => (
        <Badge variant="outline" className={statusColors[r.status] || ""}>
          <BidiText>{debitNoteStatusLabel(t, r.status)}</BidiText>
        </Badge>
      ),
    },
    {
      key: "total",
      header: t("total"),
      sortKey: "total",
      className: "w-28 text-end",
      render: (r) => (
        <span className="font-mono text-sm tabular-nums">
          <BidiText>{debitNoteUiMoney(r.total, r.currencyCode, unitPresentation)}</BidiText>
        </span>
      ),
    },
    {
      key: "remaining",
      header: t("remaining"),
      className: "w-28 text-end",
      render: (r) => (
        <span className="font-mono text-sm tabular-nums">
          <BidiText>{debitNoteUiMoney(r.amountRemaining, r.currencyCode, unitPresentation)}</BidiText>
        </span>
      ),
    },
  ];
}

export default function DebitNotesPage() {
  const unitPresentation = usePresentation();
  const dir = localeDirection(unitPresentation.locale);
  const t = useTranslations("DebitNotes");
  const router = useRouter();
  const { open: openDrawer } = useCreateDrawer();
  const [loaded, setLoaded] = useState<{ context: string; rows: DebitNote[]; total: number; page: number; error: "readFailed" | null } | null>(null);
  const [moreContext, setMoreContext] = useState<string | null>(null);
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
  const orgId = typeof window !== "undefined" ? localStorage.getItem("activeOrgId") : null;

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

  const context = `${orgId}:${buildParams(1)}`;
  const currentContext = useRef(context);
  const readGeneration = useRef(0);
  useEffect(() => { currentContext.current = context; }, [context]);
  const debitNotes = useMemo(() => loaded?.context === context ? loaded.rows : [], [loaded, context]);
  const listError = loaded?.context === context ? loaded.error : null;
  const totalCount = loaded?.context === context ? loaded.total : 0;
  const page = loaded?.context === context ? loaded.page : 1;
  const initialLoad = !!orgId && !loaded;
  const refetching = !!orgId && loaded?.context !== context;
  const loadingMore = moreContext === context;

  // Abort old reads and keep loaded rows tied to their organization/filter context.
  useEffect(() => {
    if (!orgId) return;
    ++readGeneration.current;
    const controller = new AbortController();
    fetch(`/api/v1/debit-notes?${buildParams(1)}`, {
      headers: { "x-organization-id": orgId }, signal: controller.signal,
    })
      .then(r => { if (!r.ok) throw new Error("Unable to load supplier credits"); return r.json(); })
      .then(data => {
        if (!Array.isArray(data.data)) throw new Error("Unable to load supplier credits");
        const rows = data.data.map((row: DebitNoteWire) => debitNoteUiHeader(row));
        if (!controller.signal.aborted) { setLoaded({ context, rows, total: data.pagination?.total ?? rows.length, page: 1, error: null }); setMoreContext(null); setFetchKey(k => k + 1); }
      })
      .catch(() => { if (!controller.signal.aborted) { setMoreContext(null); setLoaded({ context, rows: [], total: 0, page: 1, error: "readFailed" }); } });
    return () => controller.abort();
  }, [orgId, buildParams, context]);

  const loadMore = useCallback(() => {
    if (!orgId || loadingMore || refetching) return;
    const generation = readGeneration.current;
    const nextPage = page + 1;
    setMoreContext(context);
    fetch(`/api/v1/debit-notes?${buildParams(nextPage)}`, { headers: { "x-organization-id": orgId } })
      .then(r => { if (!r.ok) throw new Error("Unable to load supplier credits"); return r.json(); })
      .then(data => {
        if (!Array.isArray(data.data)) throw new Error("Unable to load supplier credits");
        const rows = data.data.map((row: DebitNoteWire) => debitNoteUiHeader(row));
        if (currentContext.current === context && readGeneration.current === generation) setLoaded(prev => prev?.context === context ? { ...prev, rows: [...prev.rows, ...rows], page: nextPage, error: null } : prev);
      })
      .catch(() => { if (currentContext.current === context && readGeneration.current === generation) setLoaded(prev => prev?.context === context ? { ...prev, error: "readFailed" } : prev); })
      .finally(() => { if (readGeneration.current === generation) setMoreContext(prev => prev === context ? null : prev); });
  }, [orgId, page, buildParams, loadingMore, refetching, context]);

  const hasMore = debitNotes.length < totalCount;
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
  const filteredDebitNotes = useMemo(() => {
    if (!debouncedSearch) return debitNotes;
    const q = debouncedSearch.toLowerCase();
    return debitNotes.filter(
      (dn) =>
        dn.debitNoteNumber.toLowerCase().includes(q) ||
        (dn.contact?.name || "").toLowerCase().includes(q)
    );
  }, [debitNotes, debouncedSearch]);

  // Bump searchKey when debounced search changes to trigger ContentReveal
  useEffect(() => {
    setSearchKey((k) => k + 1);
  }, [debouncedSearch]);

  const overview = useMemo(() => debitNoteUiOverview(filteredDebitNotes), [filteredDebitNotes]);

  if (initialLoad) return <BrandLoader />;
  if (listError) return <p role="alert" className="text-sm text-destructive">{t(listError)}</p>;

  if (!initialLoad && !refetching && debitNotes.length === 0 && statusFilter === "all" && !hasFilters) {
    return (
      <ContentReveal>
        <div className="pt-12 pb-12 space-y-10">
          {/* Top: title + CTA */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">{t("supplierCredits")}</h2>
              <p className="mt-1 text-sm text-muted-foreground max-w-md">
                {t("emptyDescription")}
              </p>
            </div>
            <Button
              onClick={() => openDrawer("debitNote")}
              className="h-auto min-h-8 whitespace-normal bg-emerald-600 hover:bg-emerald-700 shrink-0"
            >
              <Plus className="me-2 size-4" />
              {t("newSupplierCredit")}
            </Button>
          </div>

          <div className="grid gap-6 sm:gap-8 grid-cols-1 lg:grid-cols-[1fr_1fr] items-start">
            {/* Left: Ledger-style calculation */}
            <div className="rounded-xl border bg-card overflow-hidden">
              <div className="bg-muted/30 px-3 sm:px-5 py-3 border-b">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("howItWorks")}</p>
              </div>
              <div className="divide-y">
                <div className="flex flex-wrap items-center justify-between gap-3 px-3 sm:px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className="flex size-7 items-center justify-center rounded-md bg-blue-50 dark:bg-blue-950/40">
                      <ReceiptText className="size-3.5 text-blue-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{t("billTotal")}</p>
                      <p className="text-[11px] text-muted-foreground"><IdentifierText>BILL-0042</IdentifierText></p>
                    </div>
                  </div>
                  <span className="font-mono text-sm font-medium"><BidiText>{exampleMoney(120000n, "USD", unitPresentation)}</BidiText></span>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 px-3 sm:px-5 py-3.5 bg-teal-50/30 dark:bg-teal-950/10">
                  <div className="flex items-center gap-3">
                    <div className="flex size-7 items-center justify-center rounded-md bg-teal-50 dark:bg-teal-950/40">
                      <CreditCard className="size-3.5 text-teal-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-teal-700 dark:text-teal-300">{t("creditApplied")}</p>
                      <p className="text-[11px] text-muted-foreground"><IdentifierText>DN-0001</IdentifierText></p>
                    </div>
                  </div>
                  <span className="font-mono text-sm font-medium text-teal-600 dark:text-teal-400"><BidiText>{exampleMoney(-20000n, "USD", unitPresentation)}</BidiText></span>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 px-3 sm:px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className="size-7" />
                    <p className="text-sm font-semibold">{t("newBalance")}</p>
                  </div>
                  <span className="font-mono text-sm font-bold"><BidiText>{exampleMoney(100000n, "USD", unitPresentation)}</BidiText></span>
                </div>
              </div>
            </div>

            {/* Right: Use cases */}
            <div className="space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("whenToUse")}</p>
              {[
                {
                  title: t("overchargedTitle"),
                  desc: t("overchargedDescription"),
                  color: "border-s-blue-400",
                },
                {
                  title: t("returnedTitle"),
                  desc: t("returnedDescription"),
                  color: "border-s-amber-400",
                },
                {
                  title: t("serviceTitle"),
                  desc: t("serviceDescription"),
                  color: "border-s-teal-400",
                },
                {
                  title: t("discountTitle"),
                  desc: t("discountDescription"),
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
      {/* Top: Stats */}
      <p className="text-xs text-muted-foreground"><BidiText>{t("overviewScope", { count: filteredDebitNotes.length })}</BidiText></p>
      <DebitNoteOverview groups={overview} />

      <div className="h-px bg-border" />

      {/* Debit note table */}
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Tabs dir={dir} value={statusFilter} onValueChange={setStatusFilter}>
            <TabsList className="max-w-full overflow-x-auto">
              <TabsTrigger value="all" className="whitespace-nowrap">{t("all")}</TabsTrigger>
              <TabsTrigger value="draft" className="whitespace-nowrap">{t("draftHeading")}</TabsTrigger>
              <TabsTrigger value="sent" className="whitespace-nowrap">{t("sentHeading")}</TabsTrigger>
              <TabsTrigger value="applied" className="whitespace-nowrap" title={t("usedHint")}>{t("usedHeading")}</TabsTrigger>
              <TabsTrigger value="void" className="whitespace-nowrap">{t("cancelledHeading")}</TabsTrigger>
            </TabsList>
          </Tabs>

          <Button
            onClick={() => openDrawer("debitNote")}
            size="sm"
            className="h-auto min-h-8 whitespace-normal bg-emerald-600 hover:bg-emerald-700"
          >
            <Plus className="me-2 size-4" />
            {t("newSupplierCredit")}
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-0 max-w-full">
            <Search className="absolute start-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              aria-label={t("search")}
              dir="auto"
              placeholder={t("search")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 w-56 max-w-full ps-8 text-xs"
            />
          </div>
          <div role="group" aria-label={t("startDate")} className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-muted-foreground shrink-0">{t("from")}</span>
            <DatePicker
              value={dateFrom}
              onChange={(v) => setDateFrom(v)}
              placeholder={t("startDate")}
              className="h-8 w-40 text-xs"
            />
          </div>
          <div role="group" aria-label={t("endDate")} className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-muted-foreground shrink-0">{t("to")}</span>
            <DatePicker
              value={dateTo}
              onChange={(v) => setDateTo(v)}
              placeholder={t("endDate")}
              className="h-8 w-40 text-xs"
            />
          </div>
          <Select
            dir={dir}
            value={`${sortBy}:${sortOrder}`}
            onValueChange={(v) => {
              const [key, order] = v.split(":");
              setSortBy(key);
              setSortOrder(order as "asc" | "desc");
            }}
          >
            <SelectTrigger aria-label={t("sortBy")} className="h-auto min-h-8 w-44 max-w-full text-xs *:data-[slot=select-value]:line-clamp-none">
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
              data={filteredDebitNotes}
              loading={false}
              emptyMessage={t("noMatches")}
              onRowClick={(r) => router.push(`/purchases/debit-notes/${r.id}`)}
              sortBy={sortBy}
              sortOrder={sortOrder}
              onSort={handleSort}
            />
          </ContentReveal>
        )}

        {/* Infinite scroll sentinel & count */}
        {!refetching && !pendingSearch && filteredDebitNotes.length > 0 && (
          <>
            <div className="flex items-center justify-between pt-1">
              <p className="text-xs text-muted-foreground">
                <BidiText>{t("showing", { loaded: debitNotes.length, total: totalCount })}</BidiText>
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
