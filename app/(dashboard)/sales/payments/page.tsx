"use client";

import { useTranslations } from "next-intl";
import { salesPaymentMethodLabel, type SalesPaymentTranslate } from "@/i18n/sales-payment-presentation";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useDebounce } from "@/lib/hooks/use-debounce";
import Link from "next/link";
import { ArrowLeft, Banknote, Search, X } from "lucide-react";
import { DataTable, type Column } from "@/components/dashboard/data-table";
import { StatCard } from "@/components/dashboard/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/dashboard/empty-state";
import { BrandLoader } from "@/components/dashboard/brand-loader";
import { ContentReveal } from "@/components/ui/content-reveal";
import { useDocumentTitle } from "@/lib/hooks/use-document-title";
import { paymentUiMoney as formatMoney, paymentUiRow, paymentUiSummary } from "@/lib/money/payment-ui";
import { devDelay } from "@/lib/dev-delay";

interface Payment {
  id: string;
  paymentNumber: string;
  date: string;
  amount: bigint;
  currencyCode: string;
  method: string;
  reference: string | null;
  contact: { name: string } | null;
  allocations: { documentType: string; documentId: string; amount: bigint }[];
}

const methodColors: Record<string, string> = {
  bank_transfer: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300",
  cash: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  check: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300",
  card: "border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-800 dark:bg-purple-950 dark:text-purple-300",
  other: "",
};

function buildColumns(t: SalesPaymentTranslate): Column<Payment>[] {
  return [
    {
      key: "number",
      header: t("number"),
      sortKey: "number",
      className: "w-32",
      render: (r) => <span className="font-mono text-sm">{r.paymentNumber}</span>,
    },
    {
      key: "contact",
      header: t("customer"),
      render: (r) => <span className="text-sm font-medium">{r.contact?.name || "-"}</span>,
    },
    {
      key: "date",
      header: t("date"),
      sortKey: "date",
      className: "w-28",
      render: (r) => <span className="text-sm">{r.date}</span>,
    },
    {
      key: "method",
      header: t("method"),
      className: "w-32",
      render: (r) => (
        <Badge variant="outline" className={Object.hasOwn(methodColors, r.method) ? methodColors[r.method] : ""}>
          {salesPaymentMethodLabel(t, r.method)}
        </Badge>
      ),
    },
    {
      key: "reference",
      header: t("reference"),
      className: "w-32",
      render: (r) => <span className="text-sm text-muted-foreground">{r.reference || "-"}</span>,
    },
    {
      key: "amount",
      header: t("amount"),
      sortKey: "amount",
      className: "w-28 text-right",
      render: (r) => (
        <span className="font-mono text-sm tabular-nums break-all font-medium text-emerald-600">
          {formatMoney(r.amount, r.currencyCode)}
        </span>
      ),
    },
    {
      key: "allocations",
      header: t("allocations"),
      className: "w-28",
      render: (r) => {
        const count = r.allocations?.length || 0;
        return (
          <span className="text-sm text-muted-foreground">
            {count === 0 ? "-" : t("invoiceCount", { count })}
          </span>
        );
      },
    },
  ];
}

export default function PaymentsPage() {
  const orgId = typeof window !== "undefined" ? localStorage.getItem("activeOrgId") : null;
  return <PaymentsList key={orgId} orgId={orgId} />;
}

function PaymentsList({ orgId }: { orgId: string | null }) {
  const t = useTranslations("SalesPayments");
  const router = useRouter();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [readError, setReadError] = useState("");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search);

  useDocumentTitle(t("documentTitle"));

  const [methodFilter, setMethodFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortBy, setSortBy] = useState("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const columns = useMemo(() => buildColumns(t), [t]);

  useEffect(() => {
    if (!orgId) return;
    const controller = new AbortController();
    fetch(`/api/v1/payments?type=received`, {
      headers: { "x-organization-id": orgId }, signal: controller.signal,
    })
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then((data) => {
        if (!Array.isArray(data.data)) throw new Error();
        const rows = data.data.map(paymentUiRow) as Payment[];
        if (!controller.signal.aborted) { setPayments(rows); setReadError(""); }
      })
      .then(() => devDelay())
      .catch(() => { if (!controller.signal.aborted) { setReadError(t("readFailed")); setPayments([]); } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [orgId, t]);

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

  const [filterKey, setFilterKey] = useState(0);

  const filtered = useMemo(() => {
    let result = payments;

    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      result = result.filter(
        (p) =>
          p.paymentNumber.toLowerCase().includes(q) ||
          (p.contact?.name || "").toLowerCase().includes(q) ||
          (p.reference || "").toLowerCase().includes(q)
      );
    }

    if (methodFilter !== "all") {
      result = result.filter((p) => p.method === methodFilter);
    }

    if (dateFrom) {
      result = result.filter((p) => p.date >= dateFrom);
    }
    if (dateTo) {
      result = result.filter((p) => p.date <= dateTo);
    }

    result = [...result].sort((a, b) => {
      let cmp = 0;
      if (sortBy === "date") cmp = a.date.localeCompare(b.date);
      else if (sortBy === "amount") cmp = a.currencyCode.localeCompare(b.currencyCode) || (a.amount < b.amount ? -1 : a.amount > b.amount ? 1 : 0);
      else if (sortBy === "number") cmp = a.paymentNumber.localeCompare(b.paymentNumber);
      return sortOrder === "desc" ? -cmp : cmp;
    });

    return result;
  }, [payments, debouncedSearch, methodFilter, dateFrom, dateTo, sortBy, sortOrder]);

  // Bump filterKey when filters change to trigger ContentReveal
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFilterKey((k) => k + 1);
  }, [debouncedSearch, methodFilter, dateFrom, dateTo]);

  const summary = paymentUiSummary(filtered);
  const hasFilters = search || methodFilter !== "all" || dateFrom || dateTo;

  if (loading) return <BrandLoader />;

  if (readError) return <p role="alert">{readError}</p>;

  if (!loading && payments.length === 0) {
    return (
      <ContentReveal className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="size-8" asChild>
            <Link href="/sales" aria-label={t("backInvoices")}><ArrowLeft className="size-4" /></Link>
          </Button>
          <div>
            <h1 className="text-lg font-semibold tracking-tight">{t("title")}</h1>
            <p className="text-sm text-muted-foreground">{t("description")}</p>
          </div>
        </div>
        <EmptyState
          icon={Banknote}
          title={t("emptyTitle")}
          description={t("emptyDescription")}
        />
      </ContentReveal>
    );
  }

  return (
    <ContentReveal className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="size-8" asChild>
            <Link href="/sales" aria-label={t("backInvoices")}><ArrowLeft className="size-4" /></Link>
          </Button>
          <div>
            <h1 className="text-lg font-semibold tracking-tight">{t("title")}</h1>
            <p className="text-sm text-muted-foreground">{t("description")}</p>
          </div>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">{t("sampleHint")}</p>
      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-3 [&_div]:min-w-0 [&_.font-mono]:break-all">
        <StatCard title={t("totalReceived")} value={summary.total} icon={Banknote} changeType="positive" />
        <StatCard title={t("title")} value={filtered.length.toString()} icon={Banknote} />
        <StatCard
          title={t("average")}
          value={summary.average}
          icon={Banknote}
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            aria-label={t("search")}
            placeholder={t("search")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 w-56 pl-8 text-xs"
          />
        </div>
        <Select value={methodFilter} onValueChange={setMethodFilter}>
          <SelectTrigger className="h-8 w-40 text-xs">
            <SelectValue placeholder={t("method")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("allMethods")}</SelectItem>
            <SelectItem value="bank_transfer">{t("bankTransfer")}</SelectItem>
            <SelectItem value="cash">{t("cash")}</SelectItem>
            <SelectItem value="check">{t("check")}</SelectItem>
            <SelectItem value="card">{t("card")}</SelectItem>
            <SelectItem value="other">{t("other")}</SelectItem>
          </SelectContent>
        </Select>
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
          <SelectTrigger className="h-8 w-40 text-xs">
            <SelectValue placeholder={t("sort")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="date:desc">{t("newest")}</SelectItem>
            <SelectItem value="date:asc">{t("oldest")}</SelectItem>
            <SelectItem value="amount:desc">{t("highest")}</SelectItem>
            <SelectItem value="amount:asc">{t("lowest")}</SelectItem>
            <SelectItem value="number:desc">{t("numberDesc")}</SelectItem>
            <SelectItem value="number:asc">{t("numberAsc")}</SelectItem>
          </SelectContent>
        </Select>
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs text-muted-foreground"
            onClick={() => { setSearch(""); setMethodFilter("all"); setDateFrom(""); setDateTo(""); }}
          >
            <X className="mr-1 size-3" />
            {t("clearFilters")}
          </Button>
        )}
      </div>

      {/* Table */}
      {pendingSearch ? (
        <BrandLoader className="h-48" />
      ) : (
        <ContentReveal key={filterKey}>
          <DataTable
            columns={columns}
            data={filtered}
            loading={false}
            emptyMessage={t("noMatches")}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSort={handleSort}
            onRowClick={(r) => router.push(`/sales/payments/${r.id}`)}
          />
        </ContentReveal>
      )}
    </ContentReveal>
  );
}
