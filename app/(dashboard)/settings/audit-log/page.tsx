"use client";

import { IdentifierText } from "@/components/ui/bidi-text";

import { useTranslations } from "next-intl";
import { AUDIT_ENTITY_TYPES, auditActionLabel, auditEntityLabel, auditRelativeTime, auditDayLabel } from "@/i18n/audit-presentation";
import { usePresentation } from "@/i18n/provider";

import { useState, useEffect, useMemo } from "react";
import { useDebounce } from "@/lib/hooks/use-debounce";
import {
  Search,
  X,
  FileText,
  ArrowLeftRight,
  BookOpen,
  Users,
  Settings,
  ShoppingCart,
  Receipt,
  Wallet,
  Landmark,
  Plus,
  Pencil,
  Trash2,
  Send,
  Check,
  XCircle,
  ScrollText,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Database,
  Eraser,
  type LucideIcon,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ContentReveal } from "@/components/ui/content-reveal";
import { BrandLoader } from "@/components/dashboard/brand-loader";
import { AuditActivityText } from "@/components/settings/audit-activity-text";
import { cn } from "@/lib/utils";

interface AuditEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  ipAddress: string | null;
  userName: string;
  createdAt: string;
}

const ENTITY_ICONS: Record<string, LucideIcon> = {
  entry: ArrowLeftRight,
  journal_entry: ArrowLeftRight,
  account: BookOpen,
  invoice: FileText,
  bill: ShoppingCart,
  quote: Receipt,
  expense: Wallet,
  contact: Users,
  bank_account: Landmark,
  banking: Landmark,
  purchase_order: ShoppingCart,
  settings: Settings,
};

const ACTION_CONFIG: Record<string, { icon: LucideIcon; color: string; badgeClass: string }> = {
  create: {
    icon: Plus,
    color: "text-emerald-600 dark:text-emerald-400",
    badgeClass: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  },
  update: {
    icon: Pencil,
    color: "text-blue-600 dark:text-blue-400",
    badgeClass: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300",
  },
  delete: {
    icon: Trash2,
    color: "text-red-600 dark:text-red-400",
    badgeClass: "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300",
  },
  post: {
    icon: Check,
    color: "text-violet-600 dark:text-violet-400",
    badgeClass: "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-950 dark:text-violet-300",
  },
  void: {
    icon: XCircle,
    color: "text-orange-600 dark:text-orange-400",
    badgeClass: "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-800 dark:bg-orange-950 dark:text-orange-300",
  },
  approve: {
    icon: Check,
    color: "text-emerald-600 dark:text-emerald-400",
    badgeClass: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  },
  send: {
    icon: Send,
    color: "text-blue-600 dark:text-blue-400",
    badgeClass: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300",
  },
  restore: {
    icon: RotateCcw,
    color: "text-teal-600 dark:text-teal-400",
    badgeClass: "border-teal-200 bg-teal-50 text-teal-700 dark:border-teal-800 dark:bg-teal-950 dark:text-teal-300",
  },
  purge: {
    icon: Eraser,
    color: "text-rose-600 dark:text-rose-400",
    badgeClass: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-300",
  },
  restore_backup: {
    icon: Database,
    color: "text-amber-600 dark:text-amber-400",
    badgeClass: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300",
  },
};

const DEFAULT_ACTION_CONFIG = {
  icon: ArrowLeftRight,
  color: "text-muted-foreground",
  badgeClass: "",
};

function getActionConfig(action: string) {
  const lower = action.toLowerCase();
  for (const [key, config] of Object.entries(ACTION_CONFIG)) {
    if (lower.includes(key)) return config;
  }
  return DEFAULT_ACTION_CONFIG;
}

export default function AuditLogPage() {
  const t = useTranslations("SettingsAudit");
  const presentation = usePresentation();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search);
  const [entityTypeFilter, setEntityTypeFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const limit = 30;
  const [allEntries, setAllEntries] = useState<AuditEntry[]>([]);
  const [allTotal, setAllTotal] = useState(0);

  // Reset page on filter change
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPage(1);
  }, [entityTypeFilter, actionFilter, dateFrom, dateTo]);

  // Fetch unfiltered data for tab counts (respects entity type + date, not action)
  useEffect(() => {
    const orgId = localStorage.getItem("activeOrgId");
    if (!orgId) return;
    let cancelled = false;

    const params = new URLSearchParams();
    params.set("limit", "100");
    if (entityTypeFilter !== "all") params.set("entityType", entityTypeFilter);
    if (dateFrom) params.set("startDate", dateFrom);
    if (dateTo) params.set("endDate", dateTo);

    fetch(`/api/v1/audit-log?${params}`, {
      headers: { "x-organization-id": orgId },
    })
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) {
          setAllEntries(data.data || []);
          setAllTotal(data.total || 0);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [entityTypeFilter, dateFrom, dateTo]);

  // Fetch filtered data for display
  useEffect(() => {
    const orgId = localStorage.getItem("activeOrgId");
    if (!orgId) return;
    let cancelled = false;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("limit", String(limit));
    if (entityTypeFilter !== "all") params.set("entityType", entityTypeFilter);
    if (actionFilter !== "all") params.set("action", actionFilter);
    if (dateFrom) params.set("startDate", dateFrom);
    if (dateTo) params.set("endDate", dateTo);

    fetch(`/api/v1/audit-log?${params}`, {
      headers: { "x-organization-id": orgId },
    })
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) {
          setEntries(data.data || []);
          setTotalCount(data.total || 0);
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [entityTypeFilter, actionFilter, dateFrom, dateTo, page]);

  // Client-side search within fetched results
  const filtered = useMemo(() => {
    if (!debouncedSearch) return entries;
    const q = debouncedSearch.toLowerCase();
    return entries.filter(
      (e) =>
        e.userName.toLowerCase().includes(q) ||
        e.entityId.toLowerCase().includes(q) ||
        e.entityType.toLowerCase().includes(q) ||
        e.action.toLowerCase().includes(q)
    );
  }, [entries, debouncedSearch]);

  // Group by day
  const grouped = useMemo(() => {
    return filtered.reduce<{ label: string; items: AuditEntry[] }[]>((groups, entry) => {
      const label = auditDayLabel(t, presentation, entry.createdAt);
      const last = groups[groups.length - 1];
      if (last && last.label === label) {
        last.items.push(entry);
      } else {
        groups.push({ label, items: [entry] });
      }
      return groups;
    }, []);
  }, [filtered, t, presentation]);

  const hasFilters = search || dateFrom || dateTo || entityTypeFilter !== "all" || actionFilter !== "all";
  const totalPages = Math.ceil(totalCount / limit);

  // Action counts from unfiltered data (so tabs always show correct totals)
  const actionCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    allEntries.forEach((e) => {
      counts[e.action] = (counts[e.action] || 0) + 1;
    });
    return counts;
  }, [allEntries]);

  if (loading && entries.length === 0) return <BrandLoader />;

  return (
    <ContentReveal className="space-y-5">
          {/* Action filter tabs */}
          <Tabs value={actionFilter} onValueChange={setActionFilter}>
            <TabsList className="overflow-x-auto">
              <TabsTrigger value="all" className="whitespace-nowrap">
                {t("all")}<span className="ms-1.5 text-[10px] text-muted-foreground tabular-nums">{allTotal}</span>
              </TabsTrigger>
              {Object.entries(actionCounts).map(([action, count]) => (
                <TabsTrigger key={action} value={action} className="whitespace-nowrap capitalize">
                  {auditActionLabel(t, action)} <span className="ms-1.5 text-[10px] text-muted-foreground tabular-nums">{count}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          {/* Filter bar */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute start-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <Input
                placeholder={t("searchUserEntity")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 w-52 ps-8 text-xs" aria-label={t("searchUserEntity")} dir="auto"
              />
            </div>
            <Select value={entityTypeFilter} onValueChange={setEntityTypeFilter}>
              <SelectTrigger className="w-40 text-xs h-auto min-h-8 max-w-full whitespace-normal py-1.5 [overflow-wrap:anywhere] data-[size=default]:h-auto data-[size=sm]:h-auto *:data-[slot=select-value]:line-clamp-none *:data-[slot=select-value]:whitespace-normal" aria-label={t("entityType")}>
                <SelectValue placeholder={t("entityType")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("allEntities")}</SelectItem>
                {AUDIT_ENTITY_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>{auditEntityLabel(t, type)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground shrink-0">{t("from")}</span>
              <DatePicker
                value={dateFrom}
                onChange={(v) => setDateFrom(v)}
                placeholder={t("startDate")}
                className="h-8 w-36 text-xs"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground shrink-0">{t("to")}</span>
              <DatePicker
                value={dateTo}
                onChange={(v) => setDateTo(v)}
                placeholder={t("endDate")}
                className="h-8 w-36 text-xs"
              />
            </div>
            {hasFilters && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground h-auto min-h-8 max-w-full whitespace-normal [overflow-wrap:anywhere] py-1.5"
                onClick={() => {
                  setSearch("");
                  setEntityTypeFilter("all"); setActionFilter("all");
                  setDateFrom(""); setDateTo("");
                }}
              >
                <X className="me-1 size-3" />
                {t("clear")}
              </Button>
            )}
          </div>

          {/* Timeline list */}
          {!loading && filtered.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-center">
              <div className="flex size-12 items-center justify-center rounded-xl bg-muted mb-3">
                <ScrollText className="size-6 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium">
                {hasFilters ? t("noEntriesMatchYourFilters") : t("noAuditEntriesYet")}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {hasFilters ? t("tryAdjustingYourSearchOrFilters") : t("activityWillAppearHereAsChangesAreMade")}
              </p>
            </div>
          ) : (
            <>
            <div className="space-y-0">
              {grouped.map((group, gi) => (
                <div key={group.label}>
                  {/* Day header with dot on timeline */}
                  <div className="relative flex items-center gap-3 py-3 ps-[9px]">
                    {/* Timeline line above day label */}
                    {gi > 0 && (
                      <div className="absolute start-[12px] -top-0 h-3 w-px bg-border" />
                    )}
                    <div className="relative z-10 flex size-2 shrink-0 rounded-full bg-border ring-4 ring-background" />
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                      {group.label}
                    </p>
                    <div className="flex-1 h-px bg-border" />
                  </div>

                  {/* Timeline entries */}
                  <div className="relative">
                    {/* Continuous vertical line */}
                    <div className="absolute start-[12px] top-0 bottom-0 w-px bg-border" />

                    {group.items.map((entry, i) => {
                      const EntityIcon = ENTITY_ICONS[entry.entityType] || ArrowLeftRight;
                      const actionConfig = getActionConfig(entry.action);
                      const ActionIcon = actionConfig.icon;
                      const isLastEntry = i === group.items.length - 1 && gi === grouped.length - 1;

                      return (
                        <div
                          key={entry.id}
                          className={cn(
                            "relative flex items-start gap-3 pe-3 py-2.5 transition-colors hover:bg-muted/30 rounded-lg group",
                            isLastEntry && "pb-4"
                          )}
                        >
                          {/* Timeline node */}
                          <div className="relative z-10 mt-1 shrink-0">
                            <div className={cn(
                              "flex size-[26px] items-center justify-center rounded-md ring-2 ring-background",
                              actionConfig.badgeClass.includes("emerald")
                                ? "bg-emerald-100 dark:bg-emerald-950/60"
                                : actionConfig.badgeClass.includes("blue")
                                  ? "bg-blue-100 dark:bg-blue-950/60"
                                  : actionConfig.badgeClass.includes("red")
                                    ? "bg-red-100 dark:bg-red-950/60"
                                    : actionConfig.badgeClass.includes("violet")
                                      ? "bg-violet-100 dark:bg-violet-950/60"
                                      : actionConfig.badgeClass.includes("orange")
                                        ? "bg-orange-100 dark:bg-orange-950/60"
                                        : "bg-muted"
                            )}>
                              <ActionIcon className={cn("size-3", actionConfig.color)} />
                            </div>
                          </div>

                          {/* Content card */}
                          <div className="flex-1 min-w-0 flex flex-wrap items-start justify-between gap-3 rounded-lg border bg-card px-3.5 py-2.5 shadow-xs transition-shadow group-hover:shadow-sm">
                            <div className="min-w-0">
                              <p className="text-[13px] leading-snug">
                                <AuditActivityText userName={entry.userName} action={entry.action} entityType={entry.entityType}
                                  icon={<EntityIcon className="inline size-3 text-muted-foreground/50" />} />
                              </p>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant="outline" className={cn("text-[10px] capitalize h-[18px] px-1.5", actionConfig.badgeClass)}>
                                  {auditActionLabel(t, entry.action)}
                                </Badge>
                                <span className="font-mono text-[10px] text-muted-foreground/40"><IdentifierText>{entry.entityId.slice(0, 8)}</IdentifierText></span>
                                {entry.ipAddress && (
                                  <>
                                    <span className="text-muted-foreground/20">·</span>
                                    <span className="text-[10px] text-muted-foreground/40"><IdentifierText>{entry.ipAddress}</IdentifierText></span>
                                  </>
                                )}
                              </div>
                            </div>

                            {/* Timestamp */}
                            <div className="text-end shrink-0">
                              <p className="text-[11px] text-muted-foreground tabular-nums">
                                <IdentifierText>{new Date(entry.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</IdentifierText>
                              </p>
                              <p className="text-[10px] text-muted-foreground/40 hidden sm:block">
                                {auditRelativeTime(t, presentation, entry.createdAt)}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex flex-wrap items-center justify-between gap-3 pt-4">
                <p className="text-[11px] text-muted-foreground tabular-nums">
                  {t("pagination", { page, total: totalPages })}
                </p>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs h-auto min-h-7 max-w-full whitespace-normal [overflow-wrap:anywhere] py-1.5"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    <ChevronLeft className="size-3 me-1 rtl:rotate-180" />
                    {t("previous")}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs h-auto min-h-7 max-w-full whitespace-normal [overflow-wrap:anywhere] py-1.5"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    {t("next")}<ChevronRight className="size-3 ms-1 rtl:rotate-180" />
                  </Button>
                </div>
              </div>
            )}
            </>
          )}

      {/* Result count */}
      {filtered.length > 0 && (
        <p className="text-[11px] text-muted-foreground">
          {t("resultCount", { count: filtered.length, total: totalCount })}
        </p>
      )}
    </ContentReveal>
  );
}
