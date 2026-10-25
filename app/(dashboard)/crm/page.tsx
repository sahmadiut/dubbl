"use client";

import { BidiText, IdentifierText } from "@/components/ui/bidi-text";
import { formatExactCurrencyDecimal } from "@/i18n/numbers";
import { usePresentation as useUnitPresentation } from "@/i18n/provider";

import { useTranslations } from "next-intl";
import { crmPipelinesJson, crmDealsJson, crmPipelineCreatedJson, crmSourceKeys } from "@/i18n/crm-presentation";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useDocumentTitle } from "@/lib/hooks/use-document-title";
import { motion } from "motion/react";
import {
  Users,
  Handshake,
  BarChart3,
  ArrowRight,
  Plus,
  DollarSign,
  ArrowUpDown,
  Calendar,
  User,
  Loader2,
  Filter,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BrandLoader } from "@/components/dashboard/brand-loader";
import { ErrorState } from "@/components/dashboard/error-state";
import { PageHeader } from "@/components/dashboard/page-header";
import { ContentReveal } from "@/components/ui/content-reveal";
import { SearchInput } from "@/components/ui/search-input";
import { useCreateDrawer } from "@/components/dashboard/create-drawer";
import { useDebounce } from "@/lib/hooks/use-debounce";
import { payrollMoneyDisplay as formatMoney } from "@/lib/money/payroll-display";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CurrencySelect } from "@/components/ui/currency-select";
import { cn } from "@/lib/utils";

interface Deal {
  id: string;
  title: string;
  stageId: string;
  valueCents: number;
  currency: string;
  probability: number | null;
  contact: { name: string } | null;
  assignedUser: { name: string | null } | null;
  expectedCloseDate: string | null;
  source: string | null;
  createdAt: string;
  wonAt: string | null;
  lostAt: string | null;
}

interface Pipeline {
  id: string;
  name: string;
  stages: { id: string; name: string; color: string }[];
  isDefault: boolean;
}

interface Summary {
  currency: string;
  activeCount: number;
  activeValue: number;
  wonCount: number;
  wonValue: number;
  totalDeals: number;
  stageDistribution: Record<string, { count: number; value: number }>;
}

type SortKey = "value" | "name" | "date" | "probability";

const SORT_OPTIONS = [
  { value: "value", label: "value" },
  { value: "name", label: "name" },
  { value: "date", label: "date" },
  { value: "probability", label: "probability" },
] as const satisfies readonly { value: SortKey; label: string }[];

const SOURCE_OPTIONS = [
  { value: "all", label: "allSources" },
  { value: "website", label: "website" },
  { value: "referral", label: "referral" },
  { value: "cold_outreach", label: "coldOutreach" },
  { value: "event", label: "event" },
  { value: "other", label: "other" },
] as const;

const STATUS_OPTIONS = [
  { value: "all", label: "allStatus" },
  { value: "active", label: "active" },
  { value: "won", label: "won" },
  { value: "lost", label: "lost" },
] as const;

const DEFAULT_STAGES = [
  { id: "lead", name: "Lead", color: "#94a3b8" },
  { id: "qualified", name: "Qualified", color: "#60a5fa" },
  { id: "proposal", name: "Proposal", color: "#a78bfa" },
  { id: "negotiation", name: "Negotiation", color: "#f59e0b" },
  { id: "closed_won", name: "Won", color: "#10b981" },
  { id: "closed_lost", name: "Lost", color: "#ef4444" },
];

const PAGE_SIZE = 24;

export default function CRMPage() {
  const unitPresentation = useUnitPresentation();
  const t = useTranslations("CrmPipeline");
  const router = useRouter();
  const { open: openDrawer } = useCreateDrawer();

  // Data
  const [pipelinesReady, setPipelinesReady] = useState(false);
  const requestState = useRef({ version: 0 }).current;
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [activePipeline, setActivePipeline] = useState<Pipeline | null>(null);

  // Loading
  const [initialLoading, setInitialLoading] = useState(true);
  const [filtering, setFiltering] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [setupLoading, setSetupLoading] = useState(false);

  // Pagination
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [total, setTotal] = useState(0);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Filters
  const [currency, setCurrency] = useState("");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search);
  const [stageFilter, setStageFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState<SortKey>("value");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  useDocumentTitle(t("documentTitle"));

  function getHeaders() {
    const orgId = localStorage.getItem("activeOrgId") || "";
    if (!orgId) throw new Error("Missing organization");
    return { "x-organization-id": orgId, "Content-Type": "application/json" };
  }

  const buildParams = useCallback(
    (p: number) => {
      const params = new URLSearchParams();
      params.set("page", String(p));
      if (currency) params.set("currency", currency);
      params.set("limit", String(PAGE_SIZE));
      params.set("sortBy", sortBy === "date" ? "created" : sortBy);
      params.set("sortOrder", sortOrder);
      if (activePipeline) params.set("pipelineId", activePipeline.id);
      if (stageFilter !== "all") params.set("stageId", stageFilter);
      if (sourceFilter !== "all") params.set("source", sourceFilter);
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (debouncedSearch) params.set("search", debouncedSearch);
      return params;
    },
    [activePipeline, stageFilter, sourceFilter, statusFilter, debouncedSearch, sortBy, sortOrder, currency]
  );

  // Ignore cleaned-up pipeline reads and keep server diagnostics out of product copy.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const headers = getHeaders();
        const data = await crmPipelinesJson(await fetch("/api/v1/crm/pipelines", { headers }));
        if (cancelled) return;
        setPipelines(data.pipelines);
        setActivePipeline(data.pipelines.find(p => p.isDefault) || data.pipelines[0] || null);
        setPipelinesReady(true);
      } catch {
        if (!cancelled) { setError("pipelinesFailed"); setInitialLoading(false); }
      }
    })();
    return () => { cancelled = true; requestState.version++; };
  }, [requestState]);

  // Fetch deals when filters change
  const fetchDeals = useCallback(
    async (pageNum: number, replace: boolean) => {
      const version = replace ? ++requestState.version : requestState.version;
      if (replace) setFiltering(true);
      else setLoadingMore(true);

      try {
        const res = await fetch(`/api/v1/crm/deals?${buildParams(pageNum)}`, {
          headers: getHeaders(),
        });
        const data = await crmDealsJson(res);
        if (version !== requestState.version) return;

        if (replace) {
          setDeals(data.data || []);
        } else {
          setDeals((prev) => [...prev, ...(data.data || [])]);
        }

        if (data.summary) setSummary(data.summary);
        const t = data.pagination?.total ?? 0;
        setTotal(t);
        setHasMore(pageNum * PAGE_SIZE < t);
        setError(null);
      } catch {
        if (version !== requestState.version) return;
        if (replace) { setError("dealsFailed"); setDeals([]); setSummary(null); }
        else { setError("moreFailed"); setPage(pageNum - 1); setHasMore(false); }
      } finally {
        if (version === requestState.version) {
          setInitialLoading(false);
          setFiltering(false);
          setLoadingMore(false);
        }
      }
    },
    [buildParams, requestState]
  );

  // Reset + fetch when filters change
  useEffect(() => {
    if (!pipelinesReady) return;
    setPage(1);
    setHasMore(true);
    fetchDeals(1, true);
  }, [fetchDeals, activePipeline, pipelinesReady]);

  // Re-fetch when a deal is created from the drawer
  useEffect(() => {
    const handler = () => {
      setPage(1);
      fetchDeals(1, true);
    };
    window.addEventListener("deals-changed", handler);
    return () => window.removeEventListener("deals-changed", handler);
  }, [fetchDeals]);

  // Infinite scroll
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && !filtering && !initialLoading) {
          const nextPage = page + 1;
          setPage(nextPage);
          fetchDeals(nextPage, false);
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, filtering, initialLoading, page, fetchDeals]);

  const defaultStages = useMemo(() => DEFAULT_STAGES.map(stage => ({ ...stage, name: t(stage.id === "closed_won" ? "won" : stage.id === "closed_lost" ? "lost" : stage.id as "lead" | "qualified" | "proposal" | "negotiation") })), [t]);
  const stages = useMemo(() => {
    if (!activePipeline?.stages?.length) return defaultStages;
    return activePipeline.stages.map(stage => {
      const defaultStage = DEFAULT_STAGES.find(candidate => candidate.id === stage.id && candidate.name === stage.name);
      const localizedDefault = defaultStage && defaultStages.find(candidate => candidate.id === defaultStage.id);
      return localizedDefault ? { ...stage, name: localizedDefault.name } : stage;
    });
  }, [activePipeline, defaultStages]);

  // Stage distribution from API (full dataset, not paginated)
  const stageDistribution = useMemo(() => {
    if (!summary?.stageDistribution) return [];
    return stages.map((stage) => {
      const dist = summary.stageDistribution[stage.id];
      return { ...stage, count: dist?.count ?? 0, value: dist?.value ?? 0 };
    });
  }, [stages, summary]);

  function getStageInfo(stageId: string) {
    return stages.find((s) => s.id === stageId) || { name: stageId, color: "#94a3b8" };
  }

  async function handleSetupPipeline() {
    setSetupLoading(true);
    try {
      const res = await fetch("/api/v1/crm/pipelines", {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({
          name: "Sales Pipeline",
          stages: DEFAULT_STAGES.map((s) => ({ id: s.id, name: s.name, color: s.color })),
          isDefault: true,
        }),
      });
      await crmPipelineCreatedJson(res);
      window.location.reload();
      toast.success(t("pipelineCreated"));
    } catch {
      toast.error(t("setupFailed"));
    } finally {
      setSetupLoading(false);
    }
  }

  const hasActiveFilters = stageFilter !== "all" || sourceFilter !== "all" || statusFilter !== "all" || debouncedSearch !== "";

  function clearFilters() {
    setStageFilter("all");
    setSourceFilter("all");
    setStatusFilter("all");
    setSearch("");
  }

  if (initialLoading) return <BrandLoader />;

  if (error && pipelines.length === 0 && deals.length === 0) return <ErrorState message={t(error === "pipelinesFailed" ? "pipelinesFailed" : "dealsFailed")} onRetry={() => window.location.reload()} />;

  if (pipelines.length === 0 && deals.length === 0) {
    return (
      <ContentReveal>
        <div className="pt-12 pb-12 space-y-10">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">{t("salesPipeline")}</h2>
              <p className="mt-1 text-sm text-muted-foreground max-w-md">
                {t("intro")}
              </p>
            </div>
            <Button
              onClick={handleSetupPipeline}
              disabled={setupLoading}
              className="bg-emerald-600 hover:bg-emerald-700 shrink-0 h-auto min-w-0 max-w-full whitespace-normal [overflow-wrap:anywhere]"
            >
              <Plus className="me-2 size-4" />
              {setupLoading ? t("settingUp") : t("createPipeline")}
            </Button>
          </div>

          <div className="grid gap-6 sm:gap-8 grid-cols-1 lg:grid-cols-[1fr_1fr] items-start">
            <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
              <div className="bg-muted/30 px-5 py-3 border-b">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {t("examplePipeline")}
                </p>
              </div>
              <div className="p-5">
                <div className="flex items-center gap-2 mb-5 overflow-hidden">
                  {defaultStages.slice(0, 5).map((stage, i) => (
                    <div key={stage.id} className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5">
                        <div className="size-2 rounded-full" style={{ backgroundColor: stage.color, opacity: 0.7 }} />
                        <span className="text-[11px] font-medium text-muted-foreground whitespace-normal"><BidiText className="min-w-0 max-w-full">{stage.name}</BidiText></span>
                      </div>
                      {i < 4 && <ArrowRight className="size-3 text-muted-foreground/30 shrink-0 rtl:rotate-180" />}
                    </div>
                  ))}
                </div>
                <div className="space-y-2">
                  {[
                    { title: t("sampleTitle1"), contact: t("sampleContact1"), value: (unitPresentation.locale === "en-US" ? "$48,000" : formatExactCurrencyDecimal("48000", "USD", unitPresentation)), prob: "75%", stage: DEFAULT_STAGES[2] },
                    { title: t("sampleTitle2"), contact: t("sampleContact2"), value: (unitPresentation.locale === "en-US" ? "$24,500" : formatExactCurrencyDecimal("24500", "USD", unitPresentation)), prob: "60%", stage: DEFAULT_STAGES[1] },
                    { title: t("sampleTitle3"), contact: t("sampleContact3"), value: (unitPresentation.locale === "en-US" ? "$120,000" : formatExactCurrencyDecimal("120000", "USD", unitPresentation)), prob: "30%", stage: DEFAULT_STAGES[0] },
                  ].map((deal) => (
                    <div key={deal.title} className="flex items-center gap-3 rounded-lg border p-3">
                      <div className="size-2 rounded-full shrink-0" style={{ backgroundColor: deal.stage.color }} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium min-w-0 whitespace-normal [overflow-wrap:anywhere]"><BidiText className="min-w-0 max-w-full">{deal.title}</BidiText></p>
                        <p className="text-[11px] text-muted-foreground">{deal.contact}</p>
                      </div>
                      <div className="text-end shrink-0">
                        <p className="text-xs font-mono font-medium tabular-nums">{deal.value}</p>
                        <p className="text-[10px] text-muted-foreground">{deal.prob}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 h-px bg-border" />
                <div className="mt-3 flex flex-wrap items-center justify-between">
                  <p className="text-[11px] text-muted-foreground font-mono tabular-nums">{t("sampleSummary")}</p>
                  <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800 h-auto min-w-0 max-w-full whitespace-normal [overflow-wrap:anywhere]">
                    {t("sampleProbability")}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {t("capabilities")}
              </p>
              {[
                { title: t("trackTitle"), desc: t("trackDescription"), icon: Handshake, color: "border-s-blue-400" },
                { title: t("forecastTitle"), desc: t("forecastDescription"), icon: DollarSign, color: "border-s-emerald-400" },
                { title: t("logTitle"), desc: t("logDescription"), icon: Users, color: "border-s-orange-400" },
                { title: t("analyzeTitle"), desc: t("analyzeDescription"), icon: BarChart3, color: "border-s-violet-400" },
              ].map(({ title, desc, icon: Icon, color }) => (
                <div key={title} className={`rounded-lg border border-s-[3px] ${color} bg-card px-4 py-3`}>
                  <div className="flex items-center gap-2">
                    <Icon className="size-3.5 text-muted-foreground" />
                    <p className="text-sm font-medium"><BidiText className="min-w-0 max-w-full">{title}</BidiText></p>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 ms-[22px]"><BidiText className="min-w-0 max-w-full">{desc}</BidiText></p>
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
      <PageHeader
        title={t("salesPipeline")}
        description={
          summary
            ? t("summary", { count: summary.totalDeals, value: formatMoney(summary.activeValue, summary.currency, unitPresentation) })
            : undefined
        }
      >
        <Button size="sm" className="h-auto min-h-8 text-xs gap-1.5 whitespace-normal [overflow-wrap:anywhere] min-w-0 max-w-full" onClick={() => openDrawer("deal")}>
          <Plus className="size-3" /> {t("newDeal")}
        </Button>
      </PageHeader>

      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">{t("currency")}</span>
        <CurrencySelect className="h-auto min-h-8 whitespace-normal [overflow-wrap:anywhere]" value={currency} onValueChange={setCurrency} compact />
        {currency && <Button className="h-auto min-h-8 whitespace-normal [overflow-wrap:anywhere] min-w-0 max-w-full" size="sm" variant="ghost" onClick={() => setCurrency("")}>{t("allCurrencies")}</Button>}
      </div>
      {error && <ErrorState message={t(error === "moreFailed" ? "moreFailed" : "dealsFailed")} onRetry={() => { setPage(1); fetchDeals(1, true); }} />}
      {/* Pipeline funnel bar */}
      {summary && summary.activeCount > 0 && (
        <div className="rounded-xl border bg-card p-5">
          <div className="flex flex-wrap items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <BarChart3 className="size-4" />
              <span className="text-xs font-medium uppercase tracking-wide">{t("stageDistribution")}</span>
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="font-mono tabular-nums">{t("activeCount", { count: summary.activeCount })}</span>
              {summary.wonCount > 0 && (
                <span className="font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                  {t.rich("wonSummary", { count: summary.wonCount, value: formatMoney(summary.wonValue, summary.currency, unitPresentation) , code: chunks => <IdentifierText className="min-w-0 max-w-full">{chunks}</IdentifierText> })}
                </span>
              )}
            </div>
          </div>

          <div className="flex h-3 rounded-full overflow-hidden bg-muted">
            {stageDistribution.filter((s) => s.count > 0).map((stage) => (
              <div
                key={stage.id}
                className="transition-all duration-500 first:rounded-s-full last:rounded-e-full"
                style={{
                  width: `${(stage.count / (summary.activeCount || 1)) * 100}%`,
                  backgroundColor: stage.color,
                  opacity: 0.8,
                }}
              />
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3">
            {stageDistribution.filter((s) => s.count > 0).map((stage) => (
              <button
                key={stage.id}
                onClick={() => setStageFilter(stageFilter === stage.id ? "all" : stage.id)}
                className={cn(
                  "flex items-center gap-1.5 text-[11px] transition-colors",
                  stageFilter === stage.id ? "text-foreground font-medium" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: stage.color }} />
                {t.rich("stageSummary", { stage: stage.name, count: stage.count, value: formatMoney(stage.value, summary?.currency, unitPresentation) , em: chunks => <BidiText className="min-w-0 max-w-full">{chunks}</BidiText>, code: chunks => <IdentifierText className="min-w-0 max-w-full">{chunks}</IdentifierText> })}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Stage tabs */}
      <div className="flex flex-col gap-3">
        <div className="relative flex items-center gap-1 rounded-lg bg-muted p-1 w-fit overflow-x-auto">
          {[{ id: "all", name: t("all"), color: "" }, ...stages.filter((s) => s.id !== "closed_lost")].map((s) => {
            const isActive = stageFilter === s.id;
            return (
              <button
                key={s.id}
                onClick={() => setStageFilter(s.id)}
                className={cn(
                  "relative z-10 flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-normal",
                  isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground/80"
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="crm-tab-indicator"
                    className="absolute inset-0 rounded-md bg-background shadow-sm"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
                {s.color && (
                  <span className="relative z-10 size-1.5 rounded-full" style={{ backgroundColor: s.color }} />
                )}
                <span className="relative z-10"><BidiText className="min-w-0 max-w-full">{s.name}</BidiText></span>
              </button>
            );
          })}
        </div>

        {/* Search + filters */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder={t("search")}
            loading={search !== debouncedSearch}
          />

          <Select value={sourceFilter} onValueChange={setSourceFilter}>
            <SelectTrigger aria-label={t("source")} className="h-auto min-h-8 w-full sm:w-[140px] text-xs whitespace-normal [overflow-wrap:anywhere] data-[size=default]:h-auto data-[size=sm]:h-auto *:data-[slot=select-value]:line-clamp-none *:data-[slot=select-value]:whitespace-normal min-w-0 max-w-full">
              <Filter className="size-3 me-1.5 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SOURCE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{t(opt.label)}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger aria-label={t("allStatus")} className="h-auto min-h-8 w-full sm:w-[130px] text-xs whitespace-normal [overflow-wrap:anywhere] data-[size=default]:h-auto data-[size=sm]:h-auto *:data-[slot=select-value]:line-clamp-none *:data-[slot=select-value]:whitespace-normal min-w-0 max-w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{t(opt.label)}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortKey)}>
            <SelectTrigger aria-label={t("sortBy")} className="h-auto min-h-8 w-full sm:w-[120px] text-xs whitespace-normal [overflow-wrap:anywhere] data-[size=default]:h-auto data-[size=sm]:h-auto *:data-[slot=select-value]:line-clamp-none *:data-[slot=select-value]:whitespace-normal min-w-0 max-w-full">
              <ArrowUpDown className="size-3 me-1.5 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{t(opt.label)}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="icon"
            className="size-8 shrink-0"
            aria-label={t("sortDirection")}
            onClick={() => setSortOrder((p) => (p === "asc" ? "desc" : "asc"))}
          >
            <ArrowUpDown className={cn("size-3.5 transition-transform", sortOrder === "asc" && "rotate-180")} />
          </Button>

          {hasActiveFilters && (
            <Button variant="ghost" size="sm" className="h-auto min-h-8 text-xs gap-1 text-muted-foreground whitespace-normal [overflow-wrap:anywhere] min-w-0 max-w-full" onClick={clearFilters}>
              <X className="size-3" />
              {t("clear")}
            </Button>
          )}
        </div>
      </div>

      {/* Results count */}
      {!filtering && (
        <p className="text-[11px] text-muted-foreground">
          {t(hasActiveFilters ? "filteredCount" : "dealCount", { count: total })}
        </p>
      )}

      {/* Deal list */}
      {filtering ? (
        <BrandLoader />
      ) : deals.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="mx-auto flex size-10 items-center justify-center rounded-xl bg-muted mb-3">
            <Handshake className="size-5 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium">{t("noDeals")}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {hasActiveFilters ? t("tryFilters") : t("firstDeal")}
          </p>
          {hasActiveFilters && (
            <Button variant="outline" size="sm" className="mt-3 h-auto text-xs min-h-8 whitespace-normal [overflow-wrap:anywhere] min-w-0 max-w-full" onClick={clearFilters}>
              {t("clearFilters")}
            </Button>
          )}
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {deals.map((deal) => {
              const stage = getStageInfo(deal.stageId);
              const isWon = !!deal.wonAt;
              const isLost = !!deal.lostAt;

              return (
                <button
                  key={deal.id}
                  onClick={() => router.push(`/crm/deals/${deal.id}`)}
                  className="w-full rounded-xl border bg-card p-4 text-start transition-colors hover:bg-muted/50 space-y-3 h-auto min-h-8 whitespace-normal [overflow-wrap:anywhere]"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium min-w-0 whitespace-normal [overflow-wrap:anywhere]"><BidiText className="min-w-0 max-w-full">{deal.title}</BidiText></p>
                      {deal.contact && (
                        <div className="flex items-center gap-1 mt-0.5">
                          <User className="size-3 text-muted-foreground shrink-0" />
                          <p className="text-[11px] text-muted-foreground min-w-0 whitespace-normal [overflow-wrap:anywhere]"><BidiText className="min-w-0 max-w-full">{deal.contact.name}</BidiText></p>
                        </div>
                      )}
                    </div>
                    <Badge
                      variant="outline"
                      className="shrink-0 text-[10px] gap-1 h-auto min-w-0 max-w-full whitespace-normal [overflow-wrap:anywhere]"
                      style={{
                        borderColor: stage.color + "40",
                        backgroundColor: stage.color + "10",
                        color: stage.color,
                      }}
                    >
                      <span className="size-1.5 rounded-full" style={{ backgroundColor: stage.color }} />
                      <BidiText className="min-w-0 max-w-full">{isWon ? t("won") : isLost ? t("lost") : stage.name}</BidiText>
                    </Badge>
                  </div>

                  <div className="flex flex-wrap items-center justify-between">
                    <span className="text-lg font-bold font-mono tabular-nums tracking-tight">
                      <IdentifierText className="min-w-0 max-w-full">{formatMoney(deal.valueCents, deal.currency, unitPresentation)}</IdentifierText>
                    </span>
                    {deal.probability !== null && (
                      <div className="flex items-center gap-1.5">
                        <div className="w-12 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${deal.probability}%`,
                              backgroundColor:
                                deal.probability >= 70 ? "#10b981" : deal.probability >= 40 ? "#f59e0b" : "#94a3b8",
                            }}
                          />
                        </div>
                        <span className="text-[10px] text-muted-foreground font-mono tabular-nums">
                          <IdentifierText>{deal.probability}%</IdentifierText>
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-3 pt-2 border-t text-[11px] text-muted-foreground">
                    {deal.expectedCloseDate && (
                      <span className="flex items-center gap-1">
                        <Calendar className="size-3" />
                        <IdentifierText className="min-w-0 max-w-full">{new Date(deal.expectedCloseDate).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })}</IdentifierText>
                      </span>
                    )}
                    {deal.source && <span className="capitalize">{t(crmSourceKeys[deal.source as keyof typeof crmSourceKeys])}</span>}
                    {deal.assignedUser && (
                      <span className="ms-auto min-w-0 whitespace-normal [overflow-wrap:anywhere] max-w-[100px]"><BidiText className="min-w-0 max-w-full">{deal.assignedUser.name}</BidiText></span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Infinite scroll sentinel */}
          <div ref={sentinelRef} className="flex items-center justify-center py-4">
            {loadingMore && <Loader2 className="size-5 text-muted-foreground animate-spin" />}
            {!hasMore && !error && deals.length > 0 && (
              <p className="text-xs text-muted-foreground/50">{t("noMore")}</p>
            )}
          </div>
        </>
      )}
    </ContentReveal>
  );
}
