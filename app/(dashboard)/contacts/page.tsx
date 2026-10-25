"use client";

import { BidiText, IdentifierText } from "@/components/ui/bidi-text";

import { currencyLabel } from "@/i18n/currency-labels";
import { usePresentation } from "@/i18n/provider";
import type { NumberPresentation } from "@/i18n/numbers";
import { useFormatter, useTranslations } from "next-intl";
import { useState, useEffect, useRef, useCallback } from "react";
import { useDebounce } from "@/lib/hooks/use-debounce";
import { useDocumentTitle } from "@/lib/hooks/use-document-title";
import { useRouter } from "next/navigation";
import { Users, Search, Loader2, MoreHorizontal, Trash2, ExternalLink, UserPlus, Building2, Truck, ArrowRight, X, Target, Copy } from "lucide-react";
import { toast } from "sonner";
import { DataTable, type Column } from "@/components/dashboard/data-table";
import { PageHeader } from "@/components/dashboard/page-header";
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
import { BrandLoader } from "@/components/dashboard/brand-loader";
import { ContentReveal } from "@/components/ui/content-reveal";
import { motion, MotionConfig } from "motion/react";
import { displayMoney as formatMoney, displayJson, contactListUi } from "@/lib/money/contact-dashboard-ui";
import { devDelay } from "@/lib/dev-delay";
import { useCreateDrawer } from "@/components/dashboard/create-drawer";
import { useConfirm } from "@/lib/hooks/use-confirm";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Contact {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  taxNumber: string | null;
  type: "customer" | "supplier" | "both";
  paymentTermsDays: number;
  creditLimit: bigint | null;
  isTaxExempt: boolean;
  is1099Vendor: boolean;
  currencyCode: string | null;
  createdAt: string;
  owesYou: bigint; // customer outstanding (cents)
  youOwe: bigint; // supplier outstanding (cents)
  overdue: bigint; // total overdue across customer + supplier (cents)
}

const typeBadgeClass: Record<Contact["type"], string> = {
  customer: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300",
  supplier: "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-800 dark:bg-orange-950 dark:text-orange-300",
  both: "border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-800 dark:bg-purple-950 dark:text-purple-300",
};

type ContactTranslator = ReturnType<typeof useTranslations<"Contacts">>;

function buildColumns(t: ContactTranslator, onDelete: (c: Contact) => void, onOpen: (c: Contact) => void, onCreateLead: (c: Contact) => void, unitPresentation: NumberPresentation = { locale: "en-US", numerals: "latn" }): Column<Contact>[] {
  return [
    {
      key: "name",
      header: t("name"),
      sortKey: "name",
      className: "min-w-[200px]",
      render: (r) => (
        <div className="min-w-0">
          <p className="text-sm font-medium min-w-0 whitespace-normal [overflow-wrap:anywhere]"><BidiText className="min-w-0 max-w-full">{r.name}</BidiText></p>
          {r.email && (
            <p className="text-xs text-muted-foreground min-w-0 whitespace-normal [overflow-wrap:anywhere]"><IdentifierText className="min-w-0 max-w-full">{r.email}</IdentifierText></p>
          )}
        </div>
      ),
    },
    {
      key: "type",
      header: t("type"),
      className: "w-28",
      render: (r) => (
        <Badge variant="outline" className={(typeBadgeClass[r.type]) + " h-auto min-w-0 max-w-full whitespace-normal [overflow-wrap:anywhere]"}>
          {r.type === "customer" ? t("customer") : r.type === "supplier" ? t("supplier") : r.type === "both" ? t("both") : r.type}
        </Badge>
      ),
    },
    {
      key: "phone",
      header: t("phone"),
      className: "w-36",
      render: (r) => (
        <span className="text-sm text-muted-foreground"><IdentifierText className="min-w-0 max-w-full">{r.phone || "-"}</IdentifierText></span>
      ),
    },
    {
      key: "terms",
      header: t("paymentTerms"),
      sortKey: "terms",
      className: "w-36",
      render: (r) => (
        <span className="text-sm text-muted-foreground">
          {r.paymentTermsDays === 0 ? t("dueOnReceipt") : t("netTerms", { days: r.paymentTermsDays })}
        </span>
      ),
    },
    {
      key: "creditLimit",
      header: t("creditLimit"),
      sortKey: "creditLimit",
      className: "w-32 text-end",
      render: (r) => (
        <span className="text-sm tabular-nums text-muted-foreground">
          <IdentifierText className="min-w-0 max-w-full">{r.creditLimit != null
            ? formatMoney(r.creditLimit, r.currencyCode || "USD", unitPresentation)
            : t("noLimit")}</IdentifierText>
        </span>
      ),
    },
    {
      key: "owesYou",
      header: t("owesYou"),
      className: "w-28 text-end",
      render: (r) => (
        <span className="text-sm tabular-nums">
          {r.owesYou && r.owesYou > 0 ? (
            <span className="font-medium text-emerald-600 dark:text-emerald-400">
              <IdentifierText className="min-w-0 max-w-full">{formatMoney(r.owesYou, r.currencyCode || "USD", unitPresentation)}</IdentifierText>
            </span>
          ) : (
            <span className="text-muted-foreground">-</span>
          )}
        </span>
      ),
    },
    {
      key: "youOwe",
      header: t("youOwe"),
      className: "w-28 text-end",
      render: (r) => (
        <span className="text-sm tabular-nums">
          {r.youOwe && r.youOwe > 0 ? (
            <span className="font-medium text-orange-600 dark:text-orange-400">
              <IdentifierText className="min-w-0 max-w-full">{formatMoney(r.youOwe, r.currencyCode || "USD", unitPresentation)}</IdentifierText>
            </span>
          ) : (
            <span className="text-muted-foreground">-</span>
          )}
        </span>
      ),
    },
    {
      key: "overdue",
      header: t("overdue"),
      className: "w-28 text-end",
      render: (r) => (
        <span className="text-sm tabular-nums">
          {r.overdue && r.overdue > 0 ? (
            <span className="font-semibold text-red-600 dark:text-red-400">
              <IdentifierText className="min-w-0 max-w-full">{formatMoney(r.overdue, r.currencyCode || "USD", unitPresentation)}</IdentifierText>
            </span>
          ) : (
            <span className="text-muted-foreground">-</span>
          )}
        </span>
      ),
    },
    {
      key: "taxExempt",
      header: t("tax"),
      className: "w-32 text-center",
      render: (r) => (
        <div className="flex flex-wrap items-center justify-center gap-1">
          {r.isTaxExempt && (
            <Badge
              variant="outline"
              className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 h-auto min-w-0 max-w-full whitespace-normal [overflow-wrap:anywhere]"
              title={t("taxHint")}
            >
              {t("noTax")}
            </Badge>
          )}
          {r.is1099Vendor && (
            <Badge
              variant="outline"
              className="border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300 h-auto min-w-0 max-w-full whitespace-normal [overflow-wrap:anywhere]"
              title={t("vendorHint")}
            >
              1099
            </Badge>
          )}
          {!r.isTaxExempt && !r.is1099Vendor && (
            <span className="text-sm text-muted-foreground">-</span>
          )}
        </div>
      ),
    },
    {
      key: "currency",
      header: t("currency"),
      className: "w-24 text-center",
      render: (r) => (
        <span className="text-xs font-medium text-muted-foreground">
          {r.currencyCode ? currencyLabel(r.currencyCode, unitPresentation.locale) : "-"}
        </span>
      ),
    },
    {
      key: "createdAt",
      header: t("created"),
      sortKey: "created",
      className: "w-32 text-end whitespace-nowrap",
      render: (r) => (
        <span className="text-sm tabular-nums text-muted-foreground whitespace-nowrap">
          <IdentifierText className="min-w-0 max-w-full">{new Date(r.createdAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}</IdentifierText>
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      className: "w-10",
      render: (r) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="size-7 p-0"
              aria-label={t("actions")}
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onOpen(r); }}>
              <ExternalLink className="size-4" />
              {t("open")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onCreateLead(r); }} title={t("opportunityHint")}>
              <Target className="size-4" />
              {t("opportunity")}
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              onClick={(e) => { e.stopPropagation(); onDelete(r); }}
            >
              <Trash2 className="size-4" />
              {t("delete")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];
}

export default function ContactsPage() {
  const unitPresentation = usePresentation();
  const t = useTranslations("Contacts");
  const format = useFormatter();
  const router = useRouter();
  const { open: openDrawer } = useCreateDrawer();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search);
  const [typeFilter, setTypeFilter] = useState("all");
  const [sortBy, setSortBy] = useState("created");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [refetching, setRefetching] = useState(false);
  const [fetchKey, setFetchKey] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [total, setTotal] = useState(0);
  const sentinelRef = useRef<HTMLDivElement>(null);
  useDocumentTitle(t("documentTitle"));

  // Reset and fetch page 1 when filters change
  useEffect(() => {
    const orgId = localStorage.getItem("activeOrgId");
    if (!orgId) return;

    let cancelled = false;
    const isRefetch = !loading;

    setPage(1);
    setHasMore(true);
    if (isRefetch) setRefetching(true);

    const params = new URLSearchParams();
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (typeFilter !== "all") params.set("type", typeFilter);
    if (sortBy !== "created") params.set("sortBy", sortBy);
    if (sortOrder !== "desc") params.set("sortOrder", sortOrder);
    if (dateFrom) params.set("from", dateFrom);
    if (dateTo) params.set("to", dateTo);
    params.set("page", "1");
    params.set("limit", "50");

    fetch(`/api/v1/contacts?${params}`, {
      headers: { "x-organization-id": orgId },
    })
      .then((r) => displayJson(r, body => {
        const data = body as { data: Contact[]; pagination: { page: number; total: number; totalPages: number } };
        if (!Array.isArray(data.data)) throw new Error("Missing contacts");
        return { ...data, data: data.data.map(contactListUi) };
      }))
      .then((data) => {
        if (cancelled) return;
        if (data.data) setContacts(data.data);
        if (data.pagination) {
          setTotal(data.pagination.total);
          setHasMore(data.pagination.page < data.pagination.totalPages);
        }
      })
      .then(() => devDelay())
      .catch(() => { if (!cancelled) { setContacts([]); toast.error(t("readFailed")); } })
      .finally(() => { if (!cancelled) { setLoading(false); setRefetching(false); setFetchKey((k) => k + 1); } });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, typeFilter, sortBy, sortOrder, dateFrom, dateTo, t]);

  // Load next page
  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore) return;
    const orgId = localStorage.getItem("activeOrgId");
    if (!orgId) return;

    const nextPage = page + 1;
    setLoadingMore(true);

    const params = new URLSearchParams();
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (typeFilter !== "all") params.set("type", typeFilter);
    if (sortBy !== "created") params.set("sortBy", sortBy);
    if (sortOrder !== "desc") params.set("sortOrder", sortOrder);
    if (dateFrom) params.set("from", dateFrom);
    if (dateTo) params.set("to", dateTo);
    params.set("page", String(nextPage));
    params.set("limit", "50");

    fetch(`/api/v1/contacts?${params}`, {
      headers: { "x-organization-id": orgId },
    })
      .then((r) => displayJson(r, body => {
        const data = body as { data: Contact[]; pagination: { page: number; total: number; totalPages: number } };
        if (!Array.isArray(data.data)) throw new Error("Missing contacts");
        return { ...data, data: data.data.map(contactListUi) };
      }))
      .then((data) => {
        if (data.data) setContacts((prev) => [...prev, ...data.data]);
        if (data.pagination) {
          setPage(data.pagination.page);
          setTotal(data.pagination.total);
          setHasMore(data.pagination.page < data.pagination.totalPages);
        }
      })
      .catch(() => { setContacts([]); toast.error(t("readFailed")); })
      .finally(() => setLoadingMore(false));
  }, [loadingMore, hasMore, page, debouncedSearch, typeFilter, sortBy, sortOrder, dateFrom, dateTo, t]);

  // IntersectionObserver to trigger loadMore
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

  async function handleDelete(c: Contact) {
    await confirm({
      title: t("deleteTitle", { name: c.name }),
      description: t("deleteDescription"),
      confirmLabel: t("delete"),
      cancelLabel: t("cancel"),
      destructive: true,
      onConfirm: async () => {
        const orgId = localStorage.getItem("activeOrgId");
        if (!orgId) return;
        try {
          const res = await fetch(`/api/v1/contacts/${c.id}`, {
            method: "DELETE",
            headers: { "x-organization-id": orgId },
          });
          if (!res.ok) throw new Error("Contact delete failed");
          setContacts((prev) => prev.filter((x) => x.id !== c.id));
          setTotal((t) => t - 1);
          toast.success(t("deleted"));
        } catch {
          toast.error(t("deleteFailed"));
          throw new Error(t("deleteFailed"));
        }
      },
    });
  }

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

  const columns = buildColumns(
    t,
    handleDelete,
    (c) => router.push(`/contacts/${c.id}`),
    (c) => openDrawer("deal", { contactId: c.id, contactName: c.name }), unitPresentation
  );

  const customers = contacts.filter(
    (c) => c.type === "customer" || c.type === "both"
  );
  const suppliers = contacts.filter(
    (c) => c.type === "supplier" || c.type === "both"
  );
  const taxExemptCount = contacts.filter((c) => c.isTaxExempt).length;

  if (loading) return <BrandLoader />;

  /* ---------- Empty state ---------- */
  const hasFilters = dateFrom || dateTo;
  const pendingSearch = search !== debouncedSearch;

  if (contacts.length === 0 && !search && typeFilter === "all" && !refetching && !pendingSearch && !hasFilters) {
    return (
      <ContentReveal>
        <div className="relative flex min-h-[calc(100vh-8rem)] flex-col">
          {/* Background skeleton table */}
          <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center pt-6">
            <div className="w-full max-w-3xl rounded-lg border overflow-hidden">
              {/* Header row matching DataTable */}
              <div className="flex items-center gap-4 border-b bg-muted/50 px-4 h-10">
                <div className="h-2 w-12 rounded bg-muted-foreground/20" />
                <div className="h-2 w-8 rounded bg-muted-foreground/20" />
                <div className="h-2 w-10 rounded bg-muted-foreground/20 hidden sm:block" />
                <div className="ms-auto h-2 w-16 rounded bg-muted-foreground/20 hidden sm:block" />
                <div className="h-2 w-12 rounded bg-muted-foreground/20" />
              </div>
              {/* Data rows */}
              {[
                { badge: "bg-blue-100 text-blue-400 dark:bg-blue-900/40 dark:text-blue-500" },
                { badge: "bg-orange-100 text-orange-400 dark:bg-orange-900/40 dark:text-orange-500" },
                { badge: "bg-blue-100 text-blue-400 dark:bg-blue-900/40 dark:text-blue-500" },
                { badge: "bg-purple-100 text-purple-400 dark:bg-purple-900/40 dark:text-purple-500" },
                { badge: "bg-orange-100 text-orange-400 dark:bg-orange-900/40 dark:text-orange-500" },
                { badge: "bg-blue-100 text-blue-400 dark:bg-blue-900/40 dark:text-blue-500" },
                { badge: "bg-purple-100 text-purple-400 dark:bg-purple-900/40 dark:text-purple-500" },
                { badge: "bg-orange-100 text-orange-400 dark:bg-orange-900/40 dark:text-orange-500" },
              ].map((row, i) => (
                <div key={i} className="flex items-center gap-4 border-b last:border-0 px-4 h-12">
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className={`h-2.5 rounded bg-muted ${i % 3 === 0 ? "w-28" : i % 3 === 1 ? "w-32" : "w-24"}`} />
                    <div className={`h-2 rounded bg-muted/50 ${i % 2 === 0 ? "w-36" : "w-28"}`} />
                  </div>
                  <div className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[10px] font-medium ${row.badge} hidden sm:block`}>
                    {t(i % 3 === 0 ? "customer" : i % 3 === 1 ? "supplier" : "both")}
                  </div>
                  <div className={`h-2.5 rounded bg-muted/50 hidden sm:block ${i % 2 === 0 ? "w-20" : "w-16"}`} />
                  <div className={`h-2.5 rounded bg-muted/40 hidden sm:block ${i % 2 === 0 ? "w-16" : "w-12"}`} />
                </div>
              ))}
            </div>
            {/* Fade to background */}
            <div className="absolute inset-0 bg-gradient-to-b from-content-bg/30 via-content-bg/70 to-content-bg" />
          </div>

          {/* Top section */}
          <div className="relative flex flex-1 flex-col items-center justify-center px-4 py-8 sm:py-12 text-center">
            <div className="flex size-12 sm:size-14 items-center justify-center rounded-2xl bg-emerald-100 dark:bg-emerald-950/50">
              <Users className="size-6 sm:size-7 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h2 className="mt-4 sm:mt-5 text-lg sm:text-xl font-semibold tracking-tight">{t("emptyTitle")}</h2>
            <p className="mt-2 max-w-md text-xs sm:text-sm text-muted-foreground leading-relaxed">
              {t("emptyDescription")}
            </p>
            <Button
              onClick={() => openDrawer("contact")}
              size="lg"
              className="mt-6 bg-emerald-600 hover:bg-emerald-700 h-auto min-h-8 whitespace-normal [overflow-wrap:anywhere] min-w-0 max-w-full"
            >
              <UserPlus className="me-2 size-4" />
              {t("firstContact")}
            </Button>
          </div>

          {/* Feature cards */}
          <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-3 px-4 sm:px-0 pb-6 sm:pb-8">
            {[
              {
                icon: Building2,
                title: t("customers"),
                description: t("customersHint"),
                color: "text-blue-600 dark:text-blue-400",
                bg: "bg-blue-50 dark:bg-blue-950/40",
              },
              {
                icon: Truck,
                title: t("suppliers"),
                description: t("suppliersHint"),
                color: "text-orange-600 dark:text-orange-400",
                bg: "bg-orange-50 dark:bg-orange-950/40",
              },
              {
                icon: ArrowRight,
                title: t("linkedData"),
                description: t("linkedHint"),
                color: "text-purple-600 dark:text-purple-400",
                bg: "bg-purple-50 dark:bg-purple-950/40",
              },
            ].map(({ icon: Icon, title, description, color, bg }) => (
              <div
                key={title}
                className="group rounded-xl p-4 sm:p-5"
              >
                <div className={`flex size-9 items-center justify-center rounded-lg ${bg}`}>
                  <Icon className={`size-4.5 ${color}`} />
                </div>
                <h3 className="mt-3 text-[13px] font-semibold"><BidiText className="min-w-0 max-w-full">{title}</BidiText></h3>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                  <BidiText className="min-w-0 max-w-full">{description}</BidiText>
                </p>
              </div>
            ))}
          </div>
        </div>
      </ContentReveal>
    );
  }

  return (
    <ContentReveal>
      <div className="space-y-4 sm:space-y-6">
        {/* Header */}
        <PageHeader
          title={t("title")}
          description={t("description")}
        >
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push("/reports/duplicate-detection")}
              title={t("duplicatesHint")}
            >
              <Copy className="me-1.5 size-4" />
              {t("duplicates")}
            </Button>
            <Tabs value={typeFilter} onValueChange={setTypeFilter} className="shrink-0">
              <TabsList>
                <TabsTrigger value="all">{t("all")}</TabsTrigger>
                <TabsTrigger value="customer">{t("customers")}</TabsTrigger>
                <TabsTrigger value="supplier">{t("suppliers")}</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </PageHeader>

        {/* Contact summary */}
        <dl className={`grid overflow-hidden rounded-lg border ${taxExemptCount > 0 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3"}`}>
          {[
            {
              label: t("title"),
              count: contacts.length,
              accessibleLabel: t("contactCount", { count: contacts.length }),
              panel: "border-t-emerald-500/40 bg-emerald-50/60 dark:bg-emerald-950/20",
              dot: "bg-emerald-500",
            },
            {
              label: t("customers"),
              count: customers.length,
              accessibleLabel: t("customerCount", { count: customers.length }),
              panel: "border-t-blue-500/40 bg-blue-50/60 dark:bg-blue-950/20",
              dot: "bg-blue-500",
            },
            {
              label: t("suppliers"),
              count: suppliers.length,
              accessibleLabel: t("supplierCount", { count: suppliers.length }),
              panel: "border-t-orange-500/40 bg-orange-50/60 dark:bg-orange-950/20",
              dot: "bg-orange-500",
            },
            ...(taxExemptCount > 0 ? [{
              label: t("noTax"),
              count: taxExemptCount,
              accessibleLabel: t("noTaxCount", { count: taxExemptCount }),
              panel: "border-t-violet-500/40 bg-violet-50/60 dark:bg-violet-950/20",
              dot: "bg-violet-500",
            }] : []),
          ].map(({ label, count, accessibleLabel, panel, dot }) => (
            <div
              key={label}
              role="group"
              aria-label={accessibleLabel}
              className={`flex min-w-0 flex-col items-center justify-center border-t-4 border-e border-e-border last:border-e-0 px-3 py-6 text-center sm:px-5 sm:py-7 ${panel}`}
            >
              <dt className="order-2 mt-2 text-xs font-semibold sm:text-sm"><BidiText className="min-w-0 max-w-full">{label}</BidiText></dt>
              <dd className="order-1 flex items-center gap-2 text-lg font-semibold tabular-nums sm:text-xl">
                <span aria-hidden="true" className={`size-2.5 rounded-full ${dot}`} />
                <IdentifierText className="min-w-0 max-w-full">{format.number(count)}</IdentifierText>
              </dd>
            </div>
          ))}
        </dl>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input aria-label={t("search")} dir="auto"
              placeholder={t("search")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="ps-9"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground shrink-0">{t("from")}</span>
            <div role="group" aria-label={t("startDate")}><DatePicker
              value={dateFrom}
              onChange={(v) => setDateFrom(v)}
              placeholder={t("startDate")}
              className="h-auto min-h-8 w-40 text-xs whitespace-normal [overflow-wrap:anywhere]"
            /></div>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground shrink-0">{t("to")}</span>
            <div role="group" aria-label={t("endDate")}><DatePicker
              value={dateTo}
              onChange={(v) => setDateTo(v)}
              placeholder={t("endDate")}
              className="h-auto min-h-8 w-40 text-xs whitespace-normal [overflow-wrap:anywhere]"
            /></div>
          </div>
          <Select
            value={`${sortBy}:${sortOrder}`}
            onValueChange={(v) => {
              const [key, order] = v.split(":");
              setSortBy(key);
              setSortOrder(order as "asc" | "desc");
            }}
          >
            <SelectTrigger aria-label={t("sortBy")} className="h-auto min-h-8 w-44 text-xs whitespace-normal [overflow-wrap:anywhere] data-[size=default]:h-auto data-[size=sm]:h-auto *:data-[slot=select-value]:line-clamp-none *:data-[slot=select-value]:whitespace-normal min-w-0 max-w-full">
              <SelectValue placeholder={t("sortBy")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="created:desc">{t("newest")}</SelectItem>
              <SelectItem value="created:asc">{t("oldest")}</SelectItem>
              <SelectItem value="name:asc">{t("nameAsc")}</SelectItem>
              <SelectItem value="name:desc">{t("nameDesc")}</SelectItem>
              <SelectItem value="terms:asc">{t("shortest")}</SelectItem>
              <SelectItem value="terms:desc">{t("longest")}</SelectItem>
            </SelectContent>
          </Select>
          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              className="h-auto min-h-8 text-xs text-muted-foreground whitespace-normal [overflow-wrap:anywhere] min-w-0 max-w-full"
              onClick={() => {
                setDateFrom("");
                setDateTo("");
              }}
            >
              <X className="me-1 size-3" />
              {t("clearDates")}
            </Button>
          )}
        </div>

        {/* Table */}
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
                columns={columns}
                data={contacts}
                loading={loading}
                emptyMessage={t("empty")}
                onRowClick={(r) => router.push(`/contacts/${r.id}`)}
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
      {confirmDialog}
    </ContentReveal>
  );
}
