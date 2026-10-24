"use client";
import { bankMoneyDisplay as exampleMoney } from "@/lib/money/bank-display";
import { usePresentation } from "@/i18n/provider";
import { useTranslations } from "next-intl";
import { requireJournalResponse, journalFailureMessage } from "@/i18n/journal-presentation";

import { useState, useEffect, useMemo } from "react";
import { useDebounce } from "@/lib/hooks/use-debounce";
import { useRouter } from "next/navigation";
import {
  Plus,
  ArrowLeftRight,
  BookOpen,
  BarChart3,
  Search,
  X,
  CheckCircle2,
  FileEdit,
  Ban,
} from "lucide-react";
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
import { coreJournalSummary, coreDebitDisplay, coreDebitCompare, type DebitGroup } from "@/lib/money/core-presentation";
import { devDelay } from "@/lib/dev-delay";
import { useCreateDrawer } from "@/components/dashboard/create-drawer";
import { BrandLoader } from "@/components/dashboard/brand-loader";
import { ContentReveal } from "@/components/ui/content-reveal";
import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { useDocumentTitle } from "@/lib/hooks/use-document-title";

interface Entry {
  id: string;
  entryNumber: number;
  date: string;
  description: string;
  reference: string | null;
  status: "draft" | "posted" | "void";
  totalDebit: string;
  totalDebitMinor: string;
  debitTotals: DebitGroup[];
  createdAt: string;
}

const statusColors: Record<string, string> = {
  posted:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  draft: "",
  void: "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300",
};

export default function TransactionsPage() {
  const unitPresentation = usePresentation();
  const t = useTranslations("Journals");
  const errors = useTranslations("JournalErrors");
  const statusLabels: Record<string, string> = {
    posted: t("postedStatus"),
    draft: t("draftStatus"),
    void: t("cancelledStatus"),
  };

  const columns: Column<Entry>[] = [
    {
      key: "number",
      header: "#",
      className: "w-16",
      render: (r) => (
        <span className="font-mono text-xs text-muted-foreground">
          {r.entryNumber}
        </span>
      ),
    },
    {
      key: "date",
      header: t("date"),
      className: "w-28",
      render: (r) => <span className="text-sm">{r.date}</span>,
    },
    {
      key: "description",
      header: t("description"),
      render: (r) => (
        <div>
          <p className="text-sm font-medium">{r.description}</p>
          {r.reference && (
            <p className="text-xs text-muted-foreground">{r.reference}</p>
          )}
        </div>
      ),
    },
    {
      key: "status",
      header: t("status"),
      className: "w-24",
      render: (r) => (
        <Badge variant="outline" className={statusColors[r.status] || ""}>
          {Object.hasOwn(statusLabels, r.status) ? statusLabels[r.status] : r.status}
        </Badge>
      ),
    },
    {
      key: "amount",
      header: t("amount"),
      className: "w-28 text-right",
      render: (r) => (
        <span className="font-mono text-sm tabular-nums">
          {coreDebitDisplay([r], unitPresentation)}
        </span>
      ),
    },
  ];
  const router = useRouter();
  const { open: openDrawer } = useCreateDrawer();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortBy, setSortBy] = useState("date:desc");

  useDocumentTitle(t("manualDocumentTitle"));

  useEffect(() => {
    const orgId = localStorage.getItem("activeOrgId");
    if (!orgId) return;

    fetch("/api/v1/entries", {
      headers: { "x-organization-id": orgId },
    })
      .then(async (r) => (await requireJournalResponse(r, errors, t("loadFailed"))).json())
      .then((data) => {
        setEntries(data.entries.map(coreJournalSummary));
        setError(null);
      })
      .then(() => devDelay())
      .catch((error) => { setEntries([]); setError(journalFailureMessage(error, t("loadFailed"))); })
      .finally(() => setLoading(false));
  }, [t, errors]);

  const posted = entries.filter((e) => e.status === "posted");
  const drafts = entries.filter((e) => e.status === "draft");
  const voids = entries.filter((e) => e.status === "void");
  const totalPosted = coreDebitDisplay(posted, unitPresentation);

  const filtered = useMemo(() => {
    let result = entries;

    // Status filter
    if (statusFilter !== "all") {
      result = result.filter((e) => e.status === statusFilter);
    }

    // Search filter
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      result = result.filter(
        (e) =>
          e.description.toLowerCase().includes(q) ||
          (e.reference || "").toLowerCase().includes(q) ||
          String(e.entryNumber).includes(q)
      );
    }

    // Date range filter
    if (dateFrom) {
      result = result.filter((e) => e.date >= dateFrom);
    }
    if (dateTo) {
      result = result.filter((e) => e.date <= dateTo);
    }

    // Sort
    const [key, order] = sortBy.split(":");
    result = [...result].sort((a, b) => {
      let cmp = 0;
      if (key === "date") {
        cmp = a.date.localeCompare(b.date);
      } else if (key === "number") {
        cmp = a.entryNumber - b.entryNumber;
      } else if (key === "amount") {
        cmp = coreDebitCompare(a, b);
      }
      return order === "asc" ? cmp : -cmp;
    });

    return result;
  }, [entries, statusFilter, debouncedSearch, dateFrom, dateTo, sortBy]);

  const hasFilters = search || dateFrom || dateTo;
  const pendingSearch = search !== debouncedSearch;

  const [contentKey, setContentKey] = useState(0);
  useEffect(() => {
    setContentKey((k) => k + 1);
  }, [debouncedSearch, statusFilter, sortBy]);

  if (loading) return <BrandLoader />;
  if (error) return <p role="alert" className="text-sm text-destructive">{error}</p>;

  if (!loading && entries.length === 0) {
    return (
      <ContentReveal className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">{t("manualTitle")}</h2>
            <p className="text-sm text-muted-foreground mt-0.5">{t("manualDescription")}</p>
          </div>
          <Button
            onClick={() => openDrawer("entry")}
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            <Plus className="mr-2 size-4" />{t("newEntry")}</Button>
        </div>

        <div className="flex flex-col items-center gap-10 pt-8 pb-12">
          {/* Entry lifecycle stepper */}
          <div className="w-full max-w-xl">
            <div className="relative grid grid-cols-3 gap-0">
              <div className="absolute inset-x-[16.6667%] top-4 h-px bg-border" />
              {[
                {
                  step: "1",
                  icon: BookOpen,
                  label: t("setupAccounts"),
                  sub: t("setupHint"),
                  color: "bg-blue-500",
                  ring: "ring-blue-200 dark:ring-blue-900",
                },
                {
                  step: "2",
                  icon: ArrowLeftRight,
                  label: t("recordEntries"),
                  sub: t("recordHint"),
                  color: "bg-amber-500",
                  ring: "ring-amber-200 dark:ring-amber-900",
                },
                {
                  step: "3",
                  icon: BarChart3,
                  label: t("generateReports"),
                  sub: t("reportHint"),
                  color: "bg-emerald-500",
                  ring: "ring-emerald-200 dark:ring-emerald-900",
                },
              ].map(({ step, icon: StepIcon, label, sub, color, ring }) => (
                <div
                  key={step}
                  className="flex flex-col items-center text-center relative"
                >
                  <div
                    className={`relative z-10 flex size-8 items-center justify-center rounded-full ${color} ring-4 ${ring} text-white text-xs font-bold`}
                  >
                    {step}
                  </div>
                  <div className="mt-2.5 flex items-center gap-1.5">
                    <StepIcon className="size-3.5 text-muted-foreground" />
                    <p className="text-sm font-medium">{label}</p>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground max-w-[150px] leading-relaxed">
                    {sub}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* CTA */}
          <div className="text-center">
            <h2 className="text-lg font-semibold tracking-tight">{t("startTracking")}</h2>
            <p className="mt-1.5 text-sm text-muted-foreground">{t("firstEntryHint")}</p>
            <Button
              onClick={() => openDrawer("entry")}
              size="lg"
              className="mt-5 bg-emerald-600 hover:bg-emerald-700"
            >
              <Plus className="mr-2 size-4" />{t("newEntry")}</Button>
          </div>

          {/* Preview stat cards (empty) */}
          <div className="w-full max-w-lg grid grid-cols-1 sm:grid-cols-3 gap-3 opacity-40">
            {[
              { label: t("totalPosted"), value: exampleMoney(0n, "USD", unitPresentation) },
              { label: t("posted"), value: "0" },
              { label: t("drafts"), value: "0" },
            ].map(({ label, value }) => (
              <div
                key={label}
                className="rounded-lg border border-dashed p-3 text-center"
              >
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  {label}
                </p>
                <p className="mt-1 text-sm font-mono font-medium text-muted-foreground">
                  {value}
                </p>
              </div>
            ))}
          </div>
        </div>
      </ContentReveal>
    );
  }

  return (
    <ContentReveal className="space-y-6">
      {/* Inline stats row */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
          {/* Total in your books */}
          <div>
            <p className="text-[11px] text-muted-foreground uppercase tracking-wide">{t("totalPosted")}</p>
            <p className="mt-1 font-mono text-lg font-semibold tabular-nums">
              {totalPosted}
            </p>
          </div>

          {/* In your books count */}
          <div>
            <p className="text-[11px] text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <CheckCircle2 className="size-3 text-emerald-500" />{t("posted")}</p>
            <p className="mt-1 font-mono text-lg font-semibold tabular-nums">
              {posted.length}
            </p>
          </div>

          {/* Drafts count */}
          <div>
            <p className="text-[11px] text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <FileEdit className="size-3 text-amber-500" />{t("drafts")}</p>
            <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-amber-600 dark:text-amber-400">
              {drafts.length}
            </p>
          </div>

          {/* Cancelled count */}
          <div>
            <p className="text-[11px] text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <Ban className="size-3 text-red-500" />{t("cancelled")}</p>
            <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-red-600 dark:text-red-400">
              {voids.length}
            </p>
          </div>
        </div>

        <Button
          onClick={() => openDrawer("entry")}
          size="sm"
          className="bg-emerald-600 hover:bg-emerald-700 shrink-0"
        >
          <Plus className="mr-2 size-4" />{t("newEntry")}</Button>
      </div>

      <div className="h-px bg-border" />

      {/* Main content + activity feed */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          {/* Status filter tabs with counts */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Tabs value={statusFilter} onValueChange={setStatusFilter}>
              <TabsList className="overflow-x-auto">
                <TabsTrigger value="all" className="whitespace-nowrap">{t("all")}{" "}
                  <span className="ml-1.5 text-[10px] text-muted-foreground tabular-nums">
                    {entries.length}
                  </span>
                </TabsTrigger>
                <TabsTrigger value="posted" className="whitespace-nowrap">{t("posted")}{" "}
                  <span className="ml-1.5 text-[10px] text-muted-foreground tabular-nums">
                    {posted.length}
                  </span>
                </TabsTrigger>
                <TabsTrigger value="draft" className="whitespace-nowrap">{t("draft")}{" "}
                  <span className="ml-1.5 text-[10px] text-muted-foreground tabular-nums">
                    {drafts.length}
                  </span>
                </TabsTrigger>
                <TabsTrigger value="void" className="whitespace-nowrap">{t("cancelled")}{" "}
                  <span className="ml-1.5 text-[10px] text-muted-foreground tabular-nums">
                    {voids.length}
                  </span>
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Filter bar: search, date range, sort */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <Input
                placeholder={t("searchEntries")}
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
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="h-8 w-44 text-xs">
                <SelectValue placeholder={t("sortBy")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date:desc">{t("newestFirst")}</SelectItem>
                <SelectItem value="date:asc">{t("oldestFirst")}</SelectItem>
                <SelectItem value="number:desc">{t("numberDesc")}</SelectItem>
                <SelectItem value="number:asc">{t("numberAsc")}</SelectItem>
                <SelectItem value="amount:desc">{t("highest")}</SelectItem>
                <SelectItem value="amount:asc">{t("lowest")}</SelectItem>
              </SelectContent>
            </Select>
            {hasFilters && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs text-muted-foreground"
                onClick={() => {
                  setSearch("");
                  setDateFrom("");
                  setDateTo("");
                }}
              >
                <X className="mr-1 size-3" />{t("clearFilters")}</Button>
            )}
          </div>

          {/* Table */}
          {pendingSearch ? (
            <BrandLoader className="h-48" />
          ) : (
            <ContentReveal key={contentKey}>
              <DataTable
                columns={columns}
                data={filtered}
                loading={false}
                emptyMessage={
                  hasFilters || statusFilter !== "all"
                    ? t("noMatches")
                    : t("noEntries")
                }
                onRowClick={(r) => router.push(`/accounting/${r.id}`)}
              />
            </ContentReveal>
          )}

          {/* Count */}
          {!pendingSearch && filtered.length > 0 && (
            <p className="text-xs text-muted-foreground pt-1">
              {t("showing", { shown: filtered.length, count: entries.length })}
            </p>
          )}
        </div>

        {/* Activity feed sidebar */}
        <div className="lg:sticky lg:top-6 lg:self-start">
          <ActivityFeed />
        </div>
      </div>
    </ContentReveal>
  );
}
