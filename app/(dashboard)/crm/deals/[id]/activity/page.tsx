"use client";
import { usePresentation as useUnitPresentation } from "@/i18n/provider";

import { crmActivitiesJson, type CrmActivity } from "@/i18n/crm-presentation";
import { useCrmActivityPresentation } from "@/i18n/crm-activity-presentation";
import { toast } from "sonner";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { motion, MotionConfig } from "motion/react";
import {
  MessageSquare,
  Mail,
  Phone,
  Calendar,
  ClipboardList,
  Trophy,
  XCircle,
  Send,
  Activity,
  ArrowUpDown,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ContentReveal } from "@/components/ui/content-reveal";
import { SearchInput } from "@/components/ui/search-input";
import { useDebounce } from "@/lib/hooks/use-debounce";
import { payrollMoneyDisplay as formatMoney } from "@/lib/money/payroll-display";
import { cn } from "@/lib/utils";
import { useDealContext, getHeaders } from "../layout";

const ACTIVITY_ICONS: Record<string, typeof MessageSquare> = {
  note: MessageSquare,
  email: Mail,
  call: Phone,
  meeting: Calendar,
  task: ClipboardList,
};

const ACTIVITY_COLORS: Record<string, string> = {
  note: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  email: "bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400",
  call: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400",
  meeting: "bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-400",
  task: "bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400",
};

const ACTIVITY_BAR_COLORS: Record<string, string> = {
  note: "#64748b",
  email: "#3b82f6",
  call: "#10b981",
  meeting: "#8b5cf6",
  task: "#f59e0b",
};

type ActivitySortKey = "date" | "type";

const ACTIVITY_SORT_OPTIONS: { value: ActivitySortKey; label: "date" | "type" }[] = [
  { value: "date", label: "date" },
  { value: "type", label: "type" },
];

const EASE = [0.22, 1, 0.36, 1] as const;

type ActivityItem = CrmActivity;

export default function DealActivityPage() {
  const unitPresentation = useUnitPresentation();
  const { t, activityLabel, pluralLabel, placeholder, timeAgo, dateLabel, clock, dayKey } = useCrmActivityPresentation();
  const { id: dealId } = useParams<{ id: string }>();
  const {
    deal,
    activityType,
    setActivityType,
    activityContent,
    setActivityContent,
    submitting,
    addActivity,
  } = useDealContext();

  const isWon = !!deal.wonAt;
  const isLost = !!deal.lostAt;

  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refetching, setRefetching] = useState(false);
  const [fetchKey, setFetchKey] = useState(0);

  // Search, filter, sort
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search);
  const pendingSearch = search !== debouncedSearch;
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<ActivitySortKey>("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Pagination
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [totalAll, setTotalAll] = useState(0);
  const [typeCounts, setTypeCounts] = useState<Record<string, number>>({});
  const sentinelRef = useRef<HTMLDivElement>(null);

  function buildParams(pg: number) {
    const params = new URLSearchParams();
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (typeFilter !== "all") params.set("type", typeFilter);
    params.set("sortBy", sortBy);
    params.set("sortOrder", sortOrder);
    params.set("page", String(pg));
    params.set("limit", "30");
    return params;
  }

  const requestVersion = useRef(0);
  const moreInFlight = useRef(false);

  function adopt(data: Awaited<ReturnType<typeof crmActivitiesJson>>, append: boolean) {
    setActivities((prev) => append ? [...prev, ...data.activities.filter(row => !prev.some(saved => saved.id === row.id))] : data.activities);
    setPage(data.pagination.page);
    setTotal(data.pagination.total);
    setHasMore(data.pagination.page < data.pagination.totalPages);
    setTypeCounts(data.typeCounts);
    setTotalAll(data.totalAll);
  }

  const refreshActivities = useCallback(async () => {
    const version = ++requestVersion.current;
    moreInFlight.current = false;
    setLoadingMore(false);
    setRefetching(true);
    setHasMore(false);
    try {
      const data = await crmActivitiesJson(await fetch(`/api/v1/crm/deals/${dealId}/activities?${buildParams(1)}`, { headers: getHeaders() }), 1);
      if (version === requestVersion.current) adopt(data, false);
    } catch {
      if (version === requestVersion.current) toast.error(t("loadFailed"));
    } finally {
      if (version === requestVersion.current) {
        setLoading(false);
        setRefetching(false);
        setFetchKey(k => k + 1);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dealId, debouncedSearch, typeFilter, sortBy, sortOrder, t]);

  useEffect(() => {
    void refreshActivities();
    // The counter invalidates asynchronous requests; it is not a DOM ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return () => { requestVersion.current++; };
  }, [refreshActivities]);

  const loadMore = useCallback(async () => {
    if (loadingMore || refetching || pendingSearch || !hasMore || moreInFlight.current) return;
    const version = requestVersion.current;
    moreInFlight.current = true;
    setLoadingMore(true);
    const nextPage = page + 1;
    try {
      const data = await crmActivitiesJson(await fetch(`/api/v1/crm/deals/${dealId}/activities?${buildParams(nextPage)}`, { headers: getHeaders() }), nextPage);
      if (version === requestVersion.current) adopt(data, true);
    } catch {
      if (version === requestVersion.current) toast.error(t("loadFailed"));
    } finally {
      if (version === requestVersion.current) { moreInFlight.current = false; setLoadingMore(false); }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingMore, refetching, pendingSearch, hasMore, page, dealId, debouncedSearch, typeFilter, sortBy, sortOrder, t]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) void loadMore(); },
      { rootMargin: "200px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore]);

  async function handleAddActivity() {
    const version = requestVersion.current;
    if (await addActivity() && version === requestVersion.current) await refreshActivities();
  }

  // Group activities by date
  function groupByDate(items: ActivityItem[]) {
    const grouped: { label: string; date: string; items: ActivityItem[] }[] = [];
    const now = new Date();
    const today = dayKey(now);
    const previousDay = new Date(`${today}T00:00:00.000Z`);
    previousDay.setUTCDate(previousDay.getUTCDate() - 1);
    const yesterday = previousDay.toISOString().slice(0, 10);

    for (const activity of items) {
      const date = dayKey(new Date(activity.createdAt));
      const label =
        date === today
          ? t("today")
          : date === yesterday
            ? t("yesterday")
            : dateLabel(activity.createdAt, true);

      const existing = grouped.find((g) => g.date === date);
      if (existing) existing.items.push(activity);
      else grouped.push({ label, date, items: [activity] });
    }
    return grouped;
  }

  const grouped = groupByDate(activities);
  const hasFilters = search || typeFilter !== "all";

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="brand-loader" aria-label={t("loading")}>
          <div className="brand-loader-circle brand-loader-circle-1" />
          <div className="brand-loader-circle brand-loader-circle-2" />
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
      {/* Main column */}
      <div className="space-y-4">
        {/* Won/Lost status */}
        {isWon && (
          <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30 px-4 py-3">
            <Trophy className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium text-emerald-700 dark:text-emerald-300">{t("dealWon")}</p>
              <p className="text-[11px] text-emerald-600/70 dark:text-emerald-400/60">
                {t("closedOn", { date: dateLabel(deal.wonAt!) })}
                {deal.valueCents > 0 && <> · {formatMoney(deal.valueCents, deal.currency, unitPresentation)}</>}
              </p>
            </div>
          </div>
        )}
        {isLost && (
          <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30 px-4 py-3">
            <XCircle className="size-4 text-red-600 dark:text-red-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium text-red-700 dark:text-red-300">{t("dealLost")}</p>
              <p className="text-[11px] text-red-600/70 dark:text-red-400/60">
                {deal.lostReason
                  ? deal.lostReason
                  : t("closedOn", { date: dateLabel(deal.lostAt!) })}
              </p>
            </div>
          </div>
        )}

        {/* Composer card */}
        <div className="rounded-xl border bg-card p-5 space-y-3">
          <h3 className="text-sm font-semibold mb-1">{t("logActivity")}</h3>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(ACTIVITY_ICONS).map(([type, Icon]) => (
              <button
                key={type}
                onClick={() => setActivityType(type)}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors",
                  activityType === type
                    ? ACTIVITY_COLORS[type]
                    : "bg-muted text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="size-3" />
                <span className="capitalize">{activityLabel(type)}</span>
              </button>
            ))}
          </div>
          <Textarea
            placeholder={placeholder(activityType)}
            value={activityContent}
            onChange={(e) => setActivityContent(e.target.value)}
            className="min-h-[80px] text-sm resize-none"
            onKeyDown={(e) => {
              if (!submitting && e.key === "Enter" && (e.metaKey || e.ctrlKey) && activityContent.trim()) {
                handleAddActivity();
              }
            }}
          />
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-muted-foreground">
              {t("shortcut", { key: typeof navigator !== "undefined" && navigator.platform?.includes("Mac") ? "Cmd" : "Ctrl" })}
            </p>
            <Button
              size="sm"
              className="h-8 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700"
              onClick={handleAddActivity}
              disabled={!activityContent.trim() || submitting}
            >
              <Send className="size-3" />
              {submitting ? t("adding") : t("addActivity")}
            </Button>
          </div>
        </div>

        {/* Toolbar: search + type filter + sort */}
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder={t("search")}
            loading={pendingSearch}
          />
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="h-8 w-full sm:w-[130px] text-xs">
              <SelectValue placeholder={t("allTypes")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("allTypes")}</SelectItem>
              {Object.entries(ACTIVITY_ICONS).map(([type]) => (
                <SelectItem key={type} value={type} className="capitalize">
                  {activityLabel(type)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as ActivitySortKey)}>
            <SelectTrigger className="h-8 w-full sm:w-[120px] text-xs">
              <ArrowUpDown className="size-3 mr-1.5 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ACTIVITY_SORT_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{t(opt.label)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            className="size-8 shrink-0"
            aria-label={sortOrder === "asc" ? t("sortDescending") : t("sortAscending")}
            onClick={() => setSortOrder((p) => (p === "asc" ? "desc" : "asc"))}
          >
            <ArrowUpDown className={cn("size-3.5 transition-transform", sortOrder === "asc" && "rotate-180")} />
          </Button>
          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs text-muted-foreground"
              onClick={() => { setSearch(""); setTypeFilter("all"); }}
            >
              {t("clearFilters")}
            </Button>
          )}
        </div>

        {/* Stats row */}
        {total > 0 && (
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground px-1">
            <span className="font-medium text-foreground tabular-nums">{t("activityCount", { count: total })}</span>
            {hasFilters && (
              <>
                <span>·</span>
                <span className="tabular-nums">{t("shown", { count: activities.length })}</span>
              </>
            )}
          </div>
        )}

        {/* Activity list */}
        {refetching || pendingSearch ? (
          <div className="flex items-center justify-center py-20">
            <div className="brand-loader" aria-label={t("loading")}>
              <div className="brand-loader-circle brand-loader-circle-1" />
              <div className="brand-loader-circle brand-loader-circle-2" />
            </div>
          </div>
        ) : activities.length === 0 ? (
          <ContentReveal>
            <div className="rounded-xl border bg-card flex flex-col items-center justify-center py-16 text-center">
              <div className="mx-auto flex size-10 items-center justify-center rounded-xl bg-muted mb-3">
                <Activity className="size-5 text-muted-foreground" />
              </div>
              {hasFilters ? (
                <>
                  <p className="text-sm font-medium">{t("noMatching")}</p>
                  <p className="text-xs text-muted-foreground mt-1">{t("adjustFilters")}</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs mt-2"
                    onClick={() => { setSearch(""); setTypeFilter("all"); }}
                  >
                    {t("clearFilters")}
                  </Button>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium">{t("noActivity")}</p>
                  <p className="text-xs text-muted-foreground mt-1">{t("logFirst")}</p>
                </>
              )}
            </div>
          </ContentReveal>
        ) : (
          <MotionConfig reducedMotion="never">
            <motion.div
              key={fetchKey}
              initial={{ opacity: 0, y: 12, filter: "blur(10px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{ duration: 0.5, ease: EASE }}
              style={{ willChange: "opacity, transform, filter" }}
              className="space-y-4"
            >
              <div className="space-y-0">
                {grouped.map((group, gi) => (
                  <div key={group.date}>
                    {/* Day header with dot on timeline */}
                    <div className="relative flex items-center gap-3 py-3 pl-[9px]">
                      {gi > 0 && (
                        <div className="absolute left-[12px] -top-0 h-3 w-px bg-border" />
                      )}
                      <div className="relative z-10 flex size-2 shrink-0 rounded-full bg-border ring-4 ring-background" />
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                        {group.label}
                      </p>
                      <div className="flex-1 h-px bg-border" />
                      <span className="text-[10px] tabular-nums text-muted-foreground/40">
                        {group.items.length}
                      </span>
                    </div>

                    {/* Timeline entries */}
                    <div className="relative">
                      <div className="absolute left-[12px] top-0 bottom-0 w-px bg-border" />

                      {group.items.map((activity, i) => {
                        const Icon = ACTIVITY_ICONS[activity.type] || MessageSquare;
                        const colorClass = ACTIVITY_COLORS[activity.type] || ACTIVITY_COLORS.note;
                        const isLastEntry = i === group.items.length - 1 && gi === grouped.length - 1;

                        return (
                          <div
                            key={activity.id}
                            className={cn(
                              "relative flex items-start gap-3 pr-3 py-2.5 transition-colors hover:bg-muted/30 rounded-lg group",
                              isLastEntry && "pb-4"
                            )}
                          >
                            {/* Timeline node */}
                            <div className="relative z-10 mt-1 shrink-0">
                              <div className={cn(
                                "flex size-[26px] items-center justify-center rounded-md ring-2 ring-background",
                                colorClass
                              )}>
                                <Icon className="size-3" />
                              </div>
                            </div>

                            {/* Content card */}
                            <div className="flex-1 min-w-0 flex items-start justify-between gap-3 rounded-lg border bg-card px-3.5 py-2.5 shadow-xs transition-shadow group-hover:shadow-sm">
                              <div className="min-w-0">
                                <p className="text-[13px] leading-snug">
                                  {t.rich("logged", {
                                    name: activity.user?.name || t("system"), type: activityLabel(activity.type),
                                    strong: chunks => <span className="font-medium">{chunks}</span>,
                                    em: chunks => <span className="font-medium capitalize">{chunks}</span>,
                                  })}
                                </p>
                                {activity.content && (
                                  <p className="text-[13px] text-muted-foreground mt-1.5 whitespace-pre-wrap leading-relaxed">
                                    {activity.content}
                                  </p>
                                )}
                              </div>

                              {/* Timestamp */}
                              <div className="text-right shrink-0">
                                <p className="text-[11px] text-muted-foreground tabular-nums">
                                  {clock(activity.createdAt)}
                                </p>
                                <p className="text-[10px] text-muted-foreground/40 hidden sm:block">
                                  {timeAgo(activity.createdAt)}
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

      {/* Sidebar */}
      <div className="space-y-4">
        {/* Filter by type */}
        <div className="rounded-xl border bg-card p-4 space-y-3">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("filterByType")}</h3>
          <div className="space-y-1.5">
            {Object.entries(ACTIVITY_ICONS).map(([type, Icon]) => {
              const isActive = typeFilter === type;
              const count = typeCounts[type] || 0;
              const barWidth = totalAll > 0 ? Math.max(8, Math.round((count / totalAll) * 100)) : 0;
              return (
                <button
                  key={type}
                  onClick={() => setTypeFilter(isActive ? "all" : type)}
                  className={cn(
                    "flex items-center gap-2.5 w-full rounded-lg px-2 py-2 transition-all",
                    isActive ? "bg-muted shadow-xs" : "hover:bg-muted/50"
                  )}
                >
                  <div className={cn("flex size-6 items-center justify-center rounded-md", ACTIVITY_COLORS[type])}>
                    <Icon className="size-3" />
                  </div>
                  <div className="flex-1 text-left">
                    <div className="flex items-center justify-between">
                      <span className={cn("text-xs capitalize", isActive && "font-medium")}>{pluralLabel(type)}</span>
                      <span className="text-[10px] font-mono tabular-nums text-muted-foreground">
                        {count}
                      </span>
                    </div>
                    <div className="h-1 rounded-full bg-muted mt-1 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${barWidth}%`,
                          backgroundColor: ACTIVITY_BAR_COLORS[type] || "#94a3b8",
                        }}
                      />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
          <div className="h-px bg-border" />
          <div className="flex items-center justify-between px-2">
            <span className="text-xs text-muted-foreground">{t("totalActivities")}</span>
            <span className="text-xs font-mono tabular-nums font-bold">{totalAll}</span>
          </div>
        </div>

        {/* Quick stats */}
        {activities.length > 0 && (
          <div className="rounded-xl border bg-card p-4 space-y-3">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("quickStats")}</h3>
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{t("firstLogged")}</span>
                <span className="text-xs tabular-nums">
                  {dateLabel(activities.reduce((first, row) => Date.parse(row.createdAt) < Date.parse(first.createdAt) ? row : first).createdAt)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{t("mostRecent")}</span>
                <span className="text-xs tabular-nums">
                  {timeAgo(activities.reduce((last, row) => Date.parse(row.createdAt) > Date.parse(last.createdAt) ? row : last).createdAt)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{t("mostCommon")}</span>
                <span className="text-xs capitalize">
                  {activityLabel(Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "")}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
